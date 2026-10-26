// Top-ups: a CAPTURE order the owner approves in the browser, captured by confirm or by the webhook.
// ledger.creditTopup is keyed topup:{id}, so whichever path comes second credits nothing.
// The owner picks the wallet credit (amount_cents); PayPal is asked for credit + fee (pm-04c).
import { topupFeeCents, type Topup } from "@gottaeat/schemas";
import { and, eq } from "drizzle-orm";
import { ulid } from "ulid";
import type { Db } from "../../db";
import { topups } from "../../db/schema";
import { ApiError } from "../../http/errors";
import { creditTopup, openWallet } from "../ledger";
import { captureOrder, createOrder, requirePayPal } from "../paypal";
import { asApiError } from "./errors";

export const MIN_TOPUP_CENTS = 100n;

export type TopupRow = typeof topups.$inferSelect;

const toDto = (row: TopupRow, status: Topup["status"] = row.status as Topup["status"]): Topup => ({
  id: row.id,
  amountCents: Number(row.amountCents),
  feeCents: Number(row.feeCents),
  status,
});

// `amountCents` is the wallet credit. The route's schema caps it at MAX_TOPUP_CENTS, so it fits a Number exactly.
export async function createTopup(db: Db, userId: string, amountCents: bigint) {
  if (amountCents < MIN_TOPUP_CENTS) throw new ApiError("below_minimum", "The minimum top-up is $1.00");
  const feeCents = BigInt(topupFeeCents(Number(amountCents)));
  const client = requirePayPal();
  const id = `tup_${ulid()}`;
  const order = await createOrder(client, {
    intent: "CAPTURE",
    amountCents: amountCents + feeCents,
    customId: `topup:${id}`,
    requestId: `topup-order:${id}`,
  }).catch(asApiError);
  await db.insert(topups).values({ id, userId, amountCents, feeCents, paypalOrderId: order.id, status: "created" });
  return {
    topupId: id,
    orderId: order.id,
    feeCents: Number(feeCents),
    totalCents: Number(amountCents + feeCents),
  };
}

// What PayPal says it captured. Credited only when it matches what we stored for the top-up.
export interface TopupCapture {
  captureId: string;
  capturedCents: bigint;
  orderId?: string; // omitted when the event does not carry it
}

// Marks the top-up captured and credits the wallet in one transaction. Safe to repeat. A capture whose amount
// (credit + fee) or order differs from the stored top-up credits nothing and throws. A top-up that PayPal denied
// or that was already credited is never credited again.
export async function finishTopup(db: Db, topupId: string, capture: TopupCapture) {
  const { captureId, capturedCents, orderId } = capture;
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(topups).where(eq(topups.id, topupId)).for("update");
    if (!row) throw new Error(`capture for unknown top-up ${topupId}`);
    const charge = row.amountCents + row.feeCents;
    if (capturedCents !== charge || (orderId !== undefined && orderId !== row.paypalOrderId)) {
      throw new Error(
        `capture ${captureId} does not match top-up ${topupId}: got ${capturedCents} on ${orderId ?? "?"}, expected ${charge} on ${row.paypalOrderId}`,
      );
    }
    if (row.status !== "created" && row.status !== "failed") return;
    await openWallet(tx, row.userId);
    await creditTopup(tx, {
      topupId,
      ownerId: row.userId,
      cents: row.amountCents,
      feeCents: row.feeCents,
      idempotencyKey: `topup:${topupId}`,
    });
    await tx.update(topups).set({ status: "captured", captureId }).where(eq(topups.id, topupId));
  });
}

export async function confirmTopup(db: Db, userId: string, topupId: string): Promise<Topup> {
  const [row] = await db
    .select()
    .from(topups)
    .where(and(eq(topups.id, topupId), eq(topups.userId, userId)));
  if (!row) throw new ApiError("not_found", "Top-up not found");
  if (row.status !== "created" && row.status !== "failed") return toDto(row);
  const order = await captureOrder(requirePayPal(), row.paypalOrderId, `topup-capture:${topupId}`).catch(asApiError);
  if (order.status !== "COMPLETED" || !order.captureId || order.capturedCents !== row.amountCents + row.feeCents) {
    throw new ApiError("paypal_error", "PayPal did not complete the capture", { orderStatus: order.status });
  }
  // A pending capture has not settled: credit only when PayPal sends PAYMENT.CAPTURE.COMPLETED.
  if (order.captureStatus !== "COMPLETED") return toDto(row, "created");
  await finishTopup(db, topupId, {
    captureId: order.captureId,
    capturedCents: order.capturedCents,
    orderId: row.paypalOrderId,
  });
  const [after] = await db.select().from(topups).where(eq(topups.id, topupId));
  return toDto(after ?? row);
}
