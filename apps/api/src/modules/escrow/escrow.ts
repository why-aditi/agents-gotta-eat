// The bounty escrow lifecycle. Dev escrows (ALLOW_DEV_FUNDING) move no PayPal money, so capture and void
// only change their status. Real escrows are PayPal authorizations: capture and void call PayPal first, then
// record the result, inside the caller's transaction.
import { eq } from "drizzle-orm";
import type { Db, Tx } from "../../db";
import { bounties, escrows } from "../../db/schema";
import { ApiError } from "../../http/errors";
import { toJsonCents } from "../../lib/cents";
import { publish } from "../events";
import { clawbackEscrow } from "../ledger";
import { captureAuthorization, PayPalError, refundCapture, requirePayPal, voidAuthorization } from "../paypal";

export type EscrowRow = typeof escrows.$inferSelect;
type FinalStatus = "captured" | "voided";
// Escrow statuses: order_created | authorized | captured | voided | abandoned | reversed (after capture, PayPal
// refunded or reversed it).

// Runs a PayPal call and turns a PayPalError into a 502 paypal_error carrying PayPal's debug id.
export async function paypalCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof PayPalError) {
      throw new ApiError("paypal_error", `PayPal: ${err.message}`, { debugId: err.debugId, issue: err.issue });
    }
    throw err;
  }
}

async function finish(tx: Tx, bountyId: string, to: FinalStatus): Promise<EscrowRow> {
  const [row] = await tx.select().from(escrows).where(eq(escrows.bountyId, bountyId)).for("update");
  if (!row) throw new Error(`bounty ${bountyId} has no escrow`);
  if (row.status === to) return row;
  if (row.status === "captured" || row.status === "voided") {
    throw new Error(`escrow for bounty ${bountyId} is already ${row.status}; it cannot become ${to}`);
  }
  let captureId: string | undefined;
  if (!row.dev) {
    if (row.status !== "authorized" || !row.authorizationId) throw new ApiError("escrow_not_authorized");
    const client = requirePayPal();
    const authId = row.authorizationId;
    // Stable request ids: if PayPal succeeded but our transaction failed, the retry gets the same result.
    if (to === "captured") {
      captureId = (await paypalCall(() => captureAuthorization(client, authId, undefined, `capture:${bountyId}`)))
        .captureId;
    } else {
      await paypalCall(() => voidAuthorization(client, authId, `void:${bountyId}`));
    }
  }
  const [updated] = await tx
    .update(escrows)
    .set({ status: to, ...(captureId ? { captureId } : {}) })
    .where(eq(escrows.bountyId, bountyId))
    .returning();
  if (!updated) throw new Error(`escrow for bounty ${bountyId} vanished`);
  return updated;
}

// Locks the escrow row. Idempotent: capturing a captured escrow returns it unchanged.
export function captureEscrow(tx: Tx, bountyId: string): Promise<EscrowRow> {
  return finish(tx, bountyId, "captured");
}

// Locks the escrow row. Idempotent: voiding a voided escrow returns it unchanged.
export function voidEscrow(tx: Tx, bountyId: string): Promise<EscrowRow> {
  return finish(tx, bountyId, "voided");
}

// An admin overturned a disputed result (disp-01): refunds `cents` (the reward; the fee stays) of a real escrow's
// capture to the poster and stores the refund id, which the PAYMENT.CAPTURE.REFUNDED webhook then recognises as
// ours. Locks the escrow row and keeps it locked across the PayPal call, inside the caller's transaction, so the
// webhook (processed after commit) always sees the stored id. Stable request id: a retry after a failed commit
// gets the same refund. Idempotent: a stored refund id is returned without a call.
export async function refundEscrowForDispute(
  tx: Tx,
  bountyId: string,
  disputeId: string,
  cents: bigint,
): Promise<string> {
  const [row] = await tx.select().from(escrows).where(eq(escrows.bountyId, bountyId)).for("update");
  if (!row) throw new Error(`bounty ${bountyId} has no escrow`);
  if (row.disputeRefundId) return row.disputeRefundId;
  if (row.dev || !row.captureId) throw new Error(`escrow for bounty ${bountyId} has no PayPal capture to refund`);
  const captureId = row.captureId;
  const { refundId } = await paypalCall(() =>
    refundCapture(requirePayPal(), captureId, cents, `dispute-refund:${disputeId}`, "Bounty result overturned"),
  );
  await tx.update(escrows).set({ disputeRefundId: refundId }).where(eq(escrows.bountyId, bountyId));
  return refundId;
}

// PayPal refunded or reversed (part of) a bounty's escrow capture: the winner keeps the reward, the poster owes
// the platform what was taken back and stays frozen until a top-up repays it. Keyed by the refund id, so a
// replay moves nothing. `cents` is read only once the capture is known to be ours. False when no escrow has
// this capture id. Our own dispute refund (refundEscrowForDispute) is handled with no clawback: the ledger
// already moved that money when the dispute was resolved.
export async function reverseEscrowCapture(
  db: Db,
  input: { captureId: string; refundId: string; cents: () => bigint },
): Promise<boolean> {
  const [found] = await db
    .select({ bountyId: escrows.bountyId })
    .from(escrows)
    .where(eq(escrows.captureId, input.captureId));
  if (!found) return false;
  const cents = input.cents();
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(escrows).where(eq(escrows.bountyId, found.bountyId)).for("update");
    const [bounty] = await tx
      .select({ posterId: bounties.posterId, title: bounties.title })
      .from(bounties)
      .where(eq(bounties.id, found.bountyId));
    if (!row || !bounty) throw new Error(`escrow ${found.bountyId} vanished`);
    if (row.disputeRefundId === input.refundId) return;
    const result = await clawbackEscrow(tx, {
      bountyId: row.bountyId,
      posterId: bounty.posterId,
      cents,
      idempotencyKey: `clawback:${input.refundId}`,
    });
    if (row.status !== "reversed") {
      await tx.update(escrows).set({ status: "reversed" }).where(eq(escrows.bountyId, row.bountyId));
    }
    if (result.clawedCents > 0n) {
      await publish(tx, {
        type: "wallet.clawback",
        bountyId: null,
        ownerId: bounty.posterId,
        data: {
          source: "bounty",
          refId: row.bountyId,
          title: bounty.title,
          amountCents: toJsonCents(result.clawedCents),
          owedCents: toJsonCents(result.owedCents),
        },
      });
    }
  });
  return true;
}
