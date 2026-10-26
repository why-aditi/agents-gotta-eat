// Approvals expire after 15 minutes as a deny: the hold goes back to the wallet and the request is released.
// Done on read, on approve, and by a 60 s in-process sweep.
import { and, asc, eq, lte } from "drizzle-orm";
import type { Db, Tx } from "../../db";
import { spendRequests } from "../../db/schema";
import { release } from "../ledger";
import { insertDecision, ledgerKey, type SpendRow } from "./requests";
import { stakeHooks } from "./stake-hooks";
import { transition } from "./state";

export function isOverdue(row: SpendRow, now: Date): boolean {
  return row.status === "pending_approval" && row.expiresAt !== null && row.expiresAt.getTime() <= now.getTime();
}

// The caller holds the request row lock and has checked isOverdue.
export async function expireLocked(tx: Tx, row: SpendRow, now: Date): Promise<SpendRow> {
  const status = transition(row.status, "released");
  await release(tx, { spendRequestId: row.id, idempotencyKey: ledgerKey.release(row.id) });
  const [updated] = await tx
    .update(spendRequests)
    .set({ status, decidedAt: now })
    .where(eq(spendRequests.id, row.id))
    .returning();
  if (!updated) throw new Error(`spend request ${row.id} vanished`);
  await insertDecision(tx, {
    spendRequestId: row.id,
    gate: "owner",
    verdict: "deny",
    detail: { expired: true },
    now,
  });
  if (row.category === "stake") await stakeHooks().onStakeReleased(tx, row.id);
  return updated;
}

// Own transaction: lock, re-check, release. True when this call released it.
export async function releaseIfExpired(db: Db, spendRequestId: string, now: Date): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(spendRequests).where(eq(spendRequests.id, spendRequestId)).for("update");
    if (!row || !isOverdue(row, now)) return false;
    await expireLocked(tx, row, now);
    return true;
  });
}

// Releases every overdue pending_approval request (optionally only one owner's), each in its own transaction.
export async function releaseExpired(db: Db, now: Date, opts?: { ownerId?: string }): Promise<number> {
  const conds = [eq(spendRequests.status, "pending_approval"), lte(spendRequests.expiresAt, now)];
  if (opts?.ownerId) conds.push(eq(spendRequests.ownerId, opts.ownerId));
  const due = await db
    .select({ id: spendRequests.id })
    .from(spendRequests)
    .where(and(...conds))
    .orderBy(asc(spendRequests.expiresAt));
  let released = 0;
  for (const { id } of due) if (await releaseIfExpired(db, id, now)) released += 1;
  return released;
}

// Started by server.ts. Returns a stop function. The timer is unref'd so it never holds the process open.
export function startExpirySweep(db: Db, intervalMs: number, onError?: (err: unknown) => void): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    releaseExpired(db, new Date())
      .catch((err: unknown) => onError?.(err))
      .finally(() => {
        running = false;
      });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
