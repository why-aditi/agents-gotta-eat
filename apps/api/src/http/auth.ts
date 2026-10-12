// Bearer auth for agents (API keys) and humans (short-lived HS256 JWTs from the web server).
import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { errors as joseErrors, jwtVerify } from "jose";
import { z } from "zod";
import type { Db } from "../db";
import { agents, users } from "../db/schema";
import { newId } from "../lib/ids";
import { ApiError } from "./errors";

export type AuthMode = "agent" | "user" | "any" | "none";

export type AgentPrincipal = { type: "agent"; agentId: string; ownerId: string };
export type UserPrincipal = { type: "user"; userId: string; email: string; roles: string[] };
export type Principal = AgentPrincipal | UserPrincipal;

// Per-route options. Declare them as `config: { auth: "user", idempotent: true }` on a route.
export interface RouteConfig {
  // Required on every /v1 route. "none" only for /health and /v1/openapi.json.
  auth?: AuthMode;
  // Requires an Idempotency-Key header and replays the first response.
  idempotent?: boolean;
  // Applied to the stored copy of a 2xx response before it is saved for replays (e.g. drop a plaintext key).
  redactForReplay?: (body: unknown) => unknown;
}

declare module "fastify" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface FastifyContextConfig extends RouteConfig {}
  interface FastifyRequest {
    principal: Principal | null;
  }
}

export const AGENT_KEY_PREFIX = "gte_agent_";
// 32 random bytes as base64url is 43 characters.
const AGENT_KEY_RE = /^gte_agent_[A-Za-z0-9_-]{43}$/;
const MAX_TOKEN_LIFETIME_S = 600;

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

const JwtClaims = z.object({
  sub: z.email(),
  name: z.string().trim().min(1).max(200).optional(),
  iat: z.number(),
  exp: z.number(),
});

async function authenticateAgent(db: Db, key: string): Promise<AgentPrincipal> {
  if (!AGENT_KEY_RE.test(key)) throw new ApiError("unauthorized");
  const [row] = await db
    .select({ id: agents.id, ownerId: agents.ownerId })
    .from(agents)
    .where(and(eq(agents.apiKeyHash, hashApiKey(key)), isNull(agents.revokedAt), eq(agents.status, "active")))
    .limit(1);
  if (!row) throw new ApiError("unauthorized");
  return { type: "agent", agentId: row.id, ownerId: row.ownerId };
}

async function authenticateUser(db: Db, secret: Uint8Array, token: string): Promise<UserPrincipal> {
  let payload: unknown;
  try {
    ({ payload } = await jwtVerify(token, secret, { algorithms: ["HS256"], requiredClaims: ["sub", "exp", "iat"] }));
  } catch (err) {
    if (err instanceof joseErrors.JOSEError || err instanceof TypeError) throw new ApiError("unauthorized");
    throw err;
  }
  const claims = JwtClaims.safeParse(payload);
  if (!claims.success) throw new ApiError("unauthorized");
  const { sub, name, iat, exp } = claims.data;
  if (exp - iat > MAX_TOKEN_LIFETIME_S) throw new ApiError("unauthorized", "Token lifetime exceeds 10 minutes");

  const email = sub.trim().toLowerCase();
  const user = await upsertUser(db, email, name);
  return { type: "user", userId: user.id, email: user.email, roles: user.roles };
}

// Select first so the common case is one read. The insert races safely on the unique email.
async function upsertUser(db: Db, email: string, name: string | undefined) {
  const cols = { id: users.id, email: users.email, roles: users.roles };
  const [found] = await db.select(cols).from(users).where(eq(users.email, email)).limit(1);
  if (found) return found;
  const [created] = await db
    .insert(users)
    .values({ id: newId("usr"), email, name: name ?? null })
    .onConflictDoNothing({ target: users.email })
    .returning(cols);
  if (created) return created;
  const [raced] = await db.select(cols).from(users).where(eq(users.email, email)).limit(1);
  if (!raced) throw new Error("user upsert found no row");
  return raced;
}

export async function authenticate(db: Db, secret: Uint8Array, header: string | undefined): Promise<Principal> {
  const match = header?.match(/^Bearer +(\S+)\s*$/i);
  const token = match?.[1];
  if (!token) throw new ApiError("unauthorized");
  return token.startsWith(AGENT_KEY_PREFIX) ? authenticateAgent(db, token) : authenticateUser(db, secret, token);
}

// Runs on onRequest so unauthenticated callers never see validation details.
export function registerAuth(app: FastifyInstance, opts: { db: Db; jwtSecret: string }) {
  const secret = new TextEncoder().encode(opts.jwtSecret);
  app.decorateRequest("principal", null);

  // Fail at startup if a /v1 route forgets to declare its auth.
  app.addHook("onRoute", (route) => {
    const auth = route.config?.auth;
    if (route.url.startsWith("/v1") && auth === undefined) {
      throw new Error(`Route ${String(route.method)} ${route.url} must declare config.auth`);
    }
    if (route.config?.idempotent && (auth === undefined || auth === "none")) {
      throw new Error(`Idempotent route ${String(route.method)} ${route.url} needs an authenticated principal`);
    }
  });

  app.addHook("onRequest", async (req: FastifyRequest) => {
    const mode = req.routeOptions.config.auth ?? "none";
    if (mode === "none") return;
    const principal = await authenticate(opts.db, secret, req.headers.authorization);
    if (mode !== "any" && principal.type !== mode) {
      throw new ApiError("forbidden", `This route needs ${mode === "agent" ? "an agent API key" : "a user token"}`);
    }
    req.principal = principal;
  });
}

// For handlers: the principal, narrowed to the type the route declared.
export function requireUser(req: FastifyRequest): UserPrincipal {
  if (req.principal?.type !== "user") throw new ApiError("forbidden");
  return req.principal;
}

export function requireAgent(req: FastifyRequest): AgentPrincipal {
  if (req.principal?.type !== "agent") throw new ApiError("forbidden");
  return req.principal;
}

export function principalKey(p: Principal): string {
  return p.type === "agent" ? `agent:${p.agentId}` : `user:${p.userId}`;
}
