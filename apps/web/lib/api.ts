// Server-side api client. The browser never holds an api token: every call signs a fresh 10-minute HS256
// token for the signed-in user and calls API_URL from the Next server (server components and actions).
import "server-only";
import { ErrorBody, ErrorCode, Me } from "@gottaeat/schemas";
import { SignJWT } from "jose";
import type { z } from "zod";
import { auth } from "@/auth";

export const TOKEN_LIFETIME_S = 600;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
}

function requireEnv(name: "API_URL" | "API_JWT_SECRET"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; the web server needs it to call the api`);
  return value;
}

// Pure so tests can check claims. `now` is a Date; claims are whole seconds.
export async function signApiToken(email: string, name: string | null | undefined, secret: string, now: Date) {
  const iat = Math.floor(now.getTime() / 1000);
  const claims: { name?: string } = {};
  const trimmed = name?.trim();
  if (trimmed) claims.name = trimmed.slice(0, 200);
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(email.trim().toLowerCase())
    .setIssuedAt(iat)
    .setExpirationTime(iat + TOKEN_LIFETIME_S)
    .sign(new TextEncoder().encode(secret));
}

async function toApiError(res: Response): Promise<ApiError> {
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // Not JSON (e.g. a proxy error page); fall through to the generic error.
  }
  const parsed = ErrorBody.safeParse(json);
  if (parsed.success) {
    const { code, message, detail } = parsed.data.error;
    return new ApiError(res.status, code, message, detail);
  }
  // A well-formed envelope with an unknown code still carries a useful message.
  const loose = (json as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  const code = typeof loose?.code === "string" ? loose.code : ("internal" satisfies ErrorCode);
  const message = typeof loose?.message === "string" ? loose.message : `The api returned ${res.status}`;
  return new ApiError(res.status, code, message);
}

// `schema` null means the caller expects no body (204) or does not care about it.
export async function apiFetch<S extends z.ZodTypeAny>(
  schema: S | null,
  path: string,
  opts: ApiFetchOptions = {},
): Promise<z.infer<S>> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new ApiError(401, "unauthorized", "You are signed out. Sign in again.");

  const baseUrl = requireEnv("API_URL").replace(/\/+$/, "");
  const token = await signApiToken(email, session.user?.name, requireEnv("API_JWT_SECRET"), new Date());

  const headers: Record<string, string> = { authorization: `Bearer ${token}`, accept: "application/json" };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.idempotencyKey) headers["idempotency-key"] = opts.idempotencyKey;

  const res = await fetch(`${baseUrl}${path}`, {
    method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cache: "no-store",
  });

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204 || schema === null) return null as z.infer<S>;
  return schema.parse(await res.json());
}

export function getMe(): Promise<Me> {
  return apiFetch(Me, "/v1/me");
}
