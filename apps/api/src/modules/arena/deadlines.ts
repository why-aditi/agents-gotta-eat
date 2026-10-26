// Open bounties past their deadline move to judging: on every bounty read and from a 60 s sweep.
// Pending stakes on those bounties stay until their approval expires (policy's expiry sweep).
import { and, asc, eq, lte } from "drizzle-orm";
import type { Db } from "../../db";
import { bounties } from "../../db/schema";
import { lockBounty } from "./bounties";
import { transition } from "./state";

// Each bounty in its own transaction, re-checked under its row lock. Returns how many moved.
export async function sweepDeadlines(db: Db, now: Date = new Date()): Promise<number> {
  const due = await db
    .select({ id: bounties.id })
    .from(bounties)
    .where(and(eq(bounties.status, "open"), lte(bounties.deadlineAt, now)))
    .orderBy(asc(bounties.deadlineAt));
  let moved = 0;
  for (const { id } of due) {
    const done = await db.transaction(async (tx) => {
      const row = await lockBounty(tx, id);
      if (!row || row.status !== "open" || row.deadlineAt.getTime() > now.getTime()) return false;
      await tx
        .update(bounties)
        .set({ status: transition(row.status, "judging") })
        .where(eq(bounties.id, id));
      return true;
    });
    if (done) moved += 1;
  }
  return moved;
}

// Started by server.ts. Returns a stop function. The timer is unref'd so it never holds the process open.
export function startDeadlineSweep(db: Db, intervalMs: number, onError?: (err: unknown) => void): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    sweepDeadlines(db, new Date())
      .catch((err: unknown) => onError?.(err))
      .finally(() => {
        running = false;
      });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
