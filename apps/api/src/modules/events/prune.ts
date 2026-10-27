// Retention: events, agent_runs and the PayPal call log older than 30 days are deleted, once at startup and then
// daily.
import { lt } from "drizzle-orm";
import type { Db } from "../../db";
import { agentRuns, events } from "../../db/schema";
import { prunePayPalCalls } from "../paypal";

export const RETENTION_MS = 30 * 24 * 3_600_000;
const DAY_MS = 24 * 3_600_000;

export async function pruneEvents(
  db: Db,
  now: Date = new Date(),
): Promise<{ events: number; agentRuns: number; paypalCalls: number }> {
  const cutoff = new Date(now.getTime() - RETENTION_MS);
  const ev = await db.delete(events).where(lt(events.createdAt, cutoff));
  const runs = await db.delete(agentRuns).where(lt(agentRuns.createdAt, cutoff));
  const paypalCalls = await prunePayPalCalls(db, cutoff);
  return { events: ev.rowCount ?? 0, agentRuns: runs.rowCount ?? 0, paypalCalls };
}

// Started by server.ts. Returns a stop function. The timer is unref'd so it never holds the process open.
export function startPruneSweep(db: Db, onError?: (err: unknown) => void, intervalMs = DAY_MS): () => void {
  const run = () => {
    pruneEvents(db).catch((err: unknown) => onError?.(err));
  };
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
