// The PayPal call log (paypal_calls): one row per HTTP attempt from the typed client (its logger hook) and per
// Agent Toolkit call. Never bodies, headers or tokens. Paths keep their query keys and drop the values.
import { desc, lt } from "drizzle-orm";
import type { Db } from "../../db";
import { paypalCalls } from "../../db/schema";
import type { PayPalLogEntry } from "./client";

export type PayPalCallSource = "client" | "toolkit";

export interface PayPalCallRecord {
  method: string;
  path: string;
  // Null (or 0) when there was no response.
  status: number | null;
  debugId: string | null;
  requestId: string | null;
  durationMs: number;
  source: PayPalCallSource;
}

export type PayPalCallRow = typeof paypalCalls.$inferSelect;

export const PAYPAL_CALLS_PAGE = 100;

// "/v1/reporting/transactions?start_date=2026-01-01&page=2" -> "/v1/reporting/transactions?start_date&page".
export function redactPath(path: string): string {
  const q = path.indexOf("?");
  const base = (q === -1 ? path : path.slice(0, q)).split("#")[0]!.slice(0, 500);
  if (q === -1) return base;
  const keys = path
    .slice(q + 1)
    .split("#")[0]!
    .split("&")
    .map((pair) => pair.split("=")[0]!)
    .filter((k) => /^[A-Za-z0-9_.-]{1,64}$/.test(k));
  return keys.length ? `${base}?${[...new Set(keys)].join("&")}` : base;
}

export async function recordPayPalCall(db: Db, call: PayPalCallRecord): Promise<void> {
  await db.insert(paypalCalls).values({
    method: call.method.slice(0, 10),
    path: redactPath(call.path),
    status: call.status ? call.status : null,
    debugId: call.debugId?.slice(0, 100) ?? null,
    requestId: call.requestId?.slice(0, 200) ?? null,
    durationMs: Math.max(0, Math.round(call.durationMs)),
    source: call.source,
  });
}

// The typed client's logger: writes a row per attempt. A database error goes to onError and never fails the call.
export function paypalCallLogger(
  db: Db,
  onError: (err: unknown) => void = () => {},
): (entry: PayPalLogEntry) => Promise<void> {
  return async (entry) => {
    try {
      await recordPayPalCall(db, {
        method: entry.method,
        path: entry.path,
        status: entry.status,
        debugId: entry.debugId,
        requestId: entry.requestId,
        durationMs: entry.durationMs,
        source: "client",
      });
    } catch (err) {
      onError(err);
    }
  };
}

// Newest first by id. `cursor` is the last id of the previous page.
export async function listPayPalCalls(
  db: Db,
  opts: { cursor?: number; limit?: number } = {},
): Promise<{ items: PayPalCallRow[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? PAYPAL_CALLS_PAGE), 1), PAYPAL_CALLS_PAGE);
  const rows = await db
    .select()
    .from(paypalCalls)
    .where(opts.cursor !== undefined ? lt(paypalCalls.id, opts.cursor) : undefined)
    .orderBy(desc(paypalCalls.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  return { items: page, nextCursor: rows.length > limit ? String(page.at(-1)!.id) : null };
}

export async function prunePayPalCalls(db: Db, cutoff: Date): Promise<number> {
  const res = await db.delete(paypalCalls).where(lt(paypalCalls.createdAt, cutoff));
  return res.rowCount ?? 0;
}
