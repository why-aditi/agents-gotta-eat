// PayPal allows one reauthorization, from day 4 to day 29 after the authorization. A bounty (72 h cap) normally
// never needs it; this keeps long-running ones funded. Same sweep pattern as the deadline and expiry sweeps.
import { and, eq, isNull, lte, notInArray } from "drizzle-orm";
import type { Db } from "../../db";
import { bounties, escrows } from "../../db/schema";
import { ApiError } from "../../http/errors";
import { reauthorize, requirePayPal } from "../paypal";
import { paypalCall, type EscrowRow } from "./escrow";

export const REAUTHORIZE_AFTER_MS = 4 * 86_400_000;
export const HONOR_MS = 3 * 86_400_000;

export type ReauthorizeErrorHandler = (err: unknown, bountyId?: string) => void;

// Returns the updated escrow, or null when there was nothing to do (too soon, finished, already reauthorized).
export async function reauthorizeEscrow(db: Db, bountyId: string, now: Date = new Date()): Promise<EscrowRow | null> {
  const [row] = await db.select().from(escrows).where(eq(escrows.bountyId, bountyId));
  if (!row || row.dev || row.status !== "authorized" || !row.authorizationId || row.reauthorizedAt) return null;
  const oldId = row.authorizationId;
  const client = requirePayPal();
  let fresh;
  try {
    fresh = await paypalCall(() => reauthorize(client, oldId, `reauth:${bountyId}`));
  } catch (err) {
    // PayPal says day 4 has not come yet: try again on the next tick.
    if (err instanceof ApiError && err.detail?.issue === "REAUTHORIZATION_TOO_SOON") return null;
    throw err;
  }
  return db.transaction(async (tx) => {
    const [cur] = await tx.select().from(escrows).where(eq(escrows.bountyId, bountyId)).for("update");
    if (!cur || cur.status !== "authorized" || cur.authorizationId !== oldId || cur.reauthorizedAt) return null;
    const [updated] = await tx
      .update(escrows)
      .set({
        authorizationId: fresh.id,
        previousAuthorizationIds: [...cur.previousAuthorizationIds, oldId],
        reauthorizedAt: now,
        honorUntil: new Date(now.getTime() + HONOR_MS),
      })
      .where(eq(escrows.bountyId, bountyId))
      .returning();
    return updated ?? null;
  });
}

// Without onError, every escrow is still attempted and the first failure is thrown at the end.
export async function reauthorizeDue(
  db: Db,
  now: Date = new Date(),
  onError?: ReauthorizeErrorHandler,
): Promise<number> {
  const due = await db
    .select({ bountyId: escrows.bountyId })
    .from(escrows)
    .innerJoin(bounties, eq(bounties.id, escrows.bountyId))
    .where(
      and(
        eq(escrows.status, "authorized"),
        eq(escrows.dev, false),
        isNull(escrows.reauthorizedAt),
        lte(escrows.authorizedAt, new Date(now.getTime() - REAUTHORIZE_AFTER_MS)),
        notInArray(bounties.status, ["settled", "voided", "cancelled"]),
      ),
    );
  const failures: unknown[] = [];
  let done = 0;
  for (const { bountyId } of due) {
    try {
      if (await reauthorizeEscrow(db, bountyId, now)) done += 1;
    } catch (err) {
      if (onError) onError(err, bountyId);
      else failures.push(err);
    }
  }
  if (failures.length > 0) throw failures[0];
  return done;
}

// Started by server.ts. Returns a stop function. The timer is unref'd so it never holds the process open.
export function startReauthorizeSweep(db: Db, intervalMs: number, onError?: ReauthorizeErrorHandler): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    reauthorizeDue(db, new Date(), onError)
      .catch((err: unknown) => onError?.(err))
      .finally(() => {
        running = false;
      });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
