// Withdrawals: hold the cents, send one Payouts item, then settle or return the hold from item events.
// Only a terminal item status moves the hold. UNCLAIMED keeps it (we never rely on cancelling in sandbox).
import { desc, eq } from "drizzle-orm";
import { ulid } from "ulid";
import type { Payout } from "@gottaeat/schemas";
import type { Db } from "../../db";
import { payouts, users } from "../../db/schema";
import { ApiError } from "../../http/errors";
import { holdWithdrawal, openWallet, returnWithdrawal, settleWithdrawal } from "../ledger";
import { createPayoutBatch, PayPalError, requirePayPal } from "../paypal";

export const MIN_WITHDRAWAL_CENTS = 500n;

export type PayoutOutcome = "succeeded" | "failed" | "returned" | "canceled" | "unclaimed";
const TERMINAL = new Set(["succeeded", "failed", "returned", "canceled"]);

function toDto(row: typeof payouts.$inferSelect): Payout {
  return {
    id: row.id,
    amountCents: Number(row.amountCents),
    status: row.status as Payout["status"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listWithdrawals(db: Db, userId: string): Promise<Payout[]> {
  const rows = await db
    .select()
    .from(payouts)
    .where(eq(payouts.userId, userId))
    .orderBy(desc(payouts.createdAt), desc(payouts.id))
    .limit(100);
  return rows.map(toDto);
}

// Hold and payout row in one transaction. Sending the batch is a separate step (see sendPayout).
export async function createWithdrawal(db: Db, userId: string, amountCents: bigint): Promise<Payout> {
  if (amountCents < MIN_WITHDRAWAL_CENTS) throw new ApiError("below_minimum", "The minimum withdrawal is $5.00");
  const [user] = await db.select({ paypalEmail: users.paypalEmail }).from(users).where(eq(users.id, userId));
  if (!user?.paypalEmail) throw new ApiError("no_paypal_email");
  const id = `pay_${ulid()}`;
  return db.transaction(async (tx) => {
    await openWallet(tx, userId);
    // Before the payout row: an insufficient balance leaves nothing behind.
    await holdWithdrawal(tx, {
      payoutId: id,
      ownerId: userId,
      cents: amountCents,
      idempotencyKey: `withdrawal-hold:${id}`,
    });
    const [row] = await tx
      .insert(payouts)
      .values({ id, userId, amountCents, status: "pending", refType: "withdrawal", refId: id })
      .returning();
    return toDto(row!);
  });
}

// Moves the payout to `outcome` and settles or returns its hold, in one transaction. Terminal states never change;
// the journal keys make a repeat harmless even if the status guard were bypassed.
export async function applyPayoutOutcome(
  db: Db,
  payoutId: string,
  outcome: PayoutOutcome,
  ids: { batchId?: string | null; itemId?: string | null } = {},
) {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(payouts).where(eq(payouts.id, payoutId)).for("update");
    if (!row || TERMINAL.has(row.status) || row.status === outcome) return;
    if (outcome === "succeeded") {
      await settleWithdrawal(tx, { payoutId, cents: row.amountCents, idempotencyKey: `withdrawal-settle:${payoutId}` });
    } else if (outcome !== "unclaimed") {
      await returnWithdrawal(tx, {
        payoutId,
        ownerId: row.userId,
        cents: row.amountCents,
        idempotencyKey: `withdrawal-return:${payoutId}`,
      });
    }
    await tx
      .update(payouts)
      .set({
        status: outcome,
        paypalBatchId: row.paypalBatchId ?? ids.batchId ?? null,
        itemId: row.itemId ?? ids.itemId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(payouts.id, payoutId));
  });
}

// Sends the batch for a pending payout. The request id is the payout id, so a retry or a restarted worker gets
// PayPal's original answer instead of paying twice. A 4xx is final: the payout fails and the hold goes back.
// Anything else throws, and the job retries.
export async function sendPayout(db: Db, payoutId: string) {
  const [row] = await db
    .select({ payout: payouts, email: users.paypalEmail })
    .from(payouts)
    .innerJoin(users, eq(users.id, payouts.userId))
    .where(eq(payouts.id, payoutId));
  if (!row || row.payout.status !== "pending" || row.payout.paypalBatchId) return;
  const client = requirePayPal();
  if (!row.email) return applyPayoutOutcome(db, payoutId, "failed");
  try {
    const batch = await createPayoutBatch(client, {
      senderBatchId: payoutId,
      items: [{ senderItemId: payoutId, email: row.email, amountCents: row.payout.amountCents }],
      requestId: `payout:${payoutId}`,
    });
    await db
      .update(payouts)
      .set({ paypalBatchId: batch.batchId, itemId: batch.items[0]?.payoutItemId ?? null, updatedAt: new Date() })
      .where(eq(payouts.id, payoutId));
  } catch (err) {
    // A duplicate sender_batch_id means an earlier send already reached PayPal (crash before we stored the
    // batch id), so the money may have left: never return the hold for it. Throwing keeps the job in the
    // failed-jobs list for an admin, and the payout stays pending.
    const duplicate = err instanceof PayPalError && /DUPLICATE|ALREADY/i.test(`${err.errorName} ${err.issue}`);
    if (!duplicate && err instanceof PayPalError && err.status >= 400 && err.status < 500 && err.status !== 429) {
      await applyPayoutOutcome(db, payoutId, "failed");
      return;
    }
    throw err;
  }
}
