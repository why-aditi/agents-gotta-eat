// Opt-in per route with config.idempotent. One row per (principal, Idempotency-Key); rows older than 24 h are expired.
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Db } from "../db";
import { idempotencyKeys } from "../db/schema";
import { principalKey } from "./auth";
import { ApiError } from "./errors";

export const IDEMPOTENCY_HEADER = "idempotency-key";
export const REPLAYED_HEADER = "Idempotent-Replayed";
const KEY_RE = /^[\x20-\x7E]{1,255}$/;
const RESERVE_ATTEMPTS = 3;

type Reservation = { principal: string; key: string; redact?: (body: unknown) => unknown };
const reservations = new WeakMap<FastifyRequest, Reservation>();

// Objects with sorted keys, so {a,b} and {b,a} hash the same.
export function canonicalJson(value: unknown): string {
  if (value === undefined) return "";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? "null" : canonicalJson(v))).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export function requestHash(method: string, path: string, body: unknown): string {
  return createHash("sha256")
    .update(`${method}\n${path}\n${canonicalJson(body)}`)
    .digest("hex");
}

type Existing = { requestHash: string; status: string; responseStatus: number | null; responseBody: unknown };
type ReserveResult = { reserved: true } | { reserved: false; existing: Existing };

// Inserts an in_progress row, overwriting an expired one. Otherwise returns the live row.
async function reserve(
  db: Db,
  row: { principal: string; key: string; method: string; path: string; requestHash: string },
): Promise<ReserveResult> {
  for (let attempt = 0; attempt < RESERVE_ATTEMPTS; attempt++) {
    const result = await db.transaction(async (tx): Promise<ReserveResult | null> => {
      const inserted = await tx
        .insert(idempotencyKeys)
        .values({ ...row, status: "in_progress" })
        .onConflictDoUpdate({
          target: [idempotencyKeys.principal, idempotencyKeys.key],
          set: {
            method: row.method,
            path: row.path,
            requestHash: row.requestHash,
            status: "in_progress",
            responseStatus: null,
            responseBody: null,
            createdAt: sql`now()`,
          },
          setWhere: sql`${idempotencyKeys.createdAt} < now() - interval '24 hours'`,
        })
        .returning({ key: idempotencyKeys.key });
      if (inserted.length) return { reserved: true };
      const [existing] = await tx
        .select({
          requestHash: idempotencyKeys.requestHash,
          status: idempotencyKeys.status,
          responseStatus: idempotencyKeys.responseStatus,
          responseBody: idempotencyKeys.responseBody,
        })
        .from(idempotencyKeys)
        .where(and(eq(idempotencyKeys.principal, row.principal), eq(idempotencyKeys.key, row.key)));
      // Deleted between our insert and select (a failed request freed it): try again.
      return existing ? { reserved: false, existing } : null;
    });
    if (result) return result;
  }
  throw new ApiError("idempotency_in_progress");
}

function parsePayload(payload: unknown): unknown {
  const text = typeof payload === "string" ? payload : Buffer.isBuffer(payload) ? payload.toString("utf8") : null;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function replay(reply: FastifyReply, existing: Existing) {
  reply.code(existing.responseStatus ?? 200).header(REPLAYED_HEADER, "true");
  if (existing.responseBody === null || existing.responseBody === undefined) return reply.send();
  // A string payload skips the route serializer, so the stored JSON goes out unchanged.
  return reply.type("application/json").send(JSON.stringify(existing.responseBody));
}

export function registerIdempotency(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  // After auth and validation, so rejected requests never hold a key.
  app.addHook("preHandler", async (req, reply) => {
    const config = req.routeOptions.config;
    if (!config.idempotent) return;
    const key = req.headers[IDEMPOTENCY_HEADER];
    if (typeof key !== "string" || !KEY_RE.test(key)) throw new ApiError("idempotency_key_required");
    if (!req.principal) throw new ApiError("unauthorized");

    const principal = principalKey(req.principal);
    const path = req.url;
    const hash = requestHash(req.method, path, req.body);
    const result = await reserve(db, { principal, key, method: req.method, path, requestHash: hash });
    if (result.reserved) {
      reservations.set(req, { principal, key, redact: config.redactForReplay });
      return;
    }
    const { existing } = result;
    if (existing.requestHash !== hash) throw new ApiError("idempotency_key_reuse");
    if (existing.status !== "done") throw new ApiError("idempotency_in_progress");
    return replay(reply, existing);
  });

  // Stores the response this request is about to send, or frees the key on a server error.
  app.addHook("onSend", async (req, reply, payload) => {
    const r = reservations.get(req);
    if (!r) return payload;
    reservations.delete(req);
    const where = and(eq(idempotencyKeys.principal, r.principal), eq(idempotencyKeys.key, r.key));
    try {
      if (reply.statusCode >= 500) {
        await db.delete(idempotencyKeys).where(where);
        return payload;
      }
      let body = parsePayload(payload);
      if (r.redact && reply.statusCode < 300 && body !== null) body = r.redact(structuredClone(body));
      await db
        .update(idempotencyKeys)
        .set({ status: "done", responseStatus: reply.statusCode, responseBody: body })
        .where(where);
    } catch (err) {
      // The response already reflects committed work, so send it. The key stays in_progress until it expires.
      req.log.error({ err }, "failed to record idempotent response");
    }
    return payload;
  });
}
