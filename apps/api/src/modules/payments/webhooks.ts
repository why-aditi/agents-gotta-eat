// Processing of stored webhook events, and this module's handlers (top-up captures and payout items).
import { eq } from "drizzle-orm";
import type { Db } from "../../db";
import { payouts, webhookEvents } from "../../db/schema";
import { escrowWebhookHandlers } from "../arena";
import { valueToCents, type PayPalWebhookEvent } from "../paypal";
import { handlersFor, registerWebhookHandler } from "./registry";
import { finishTopup } from "./topups";
import { applyPayoutOutcome, type PayoutOutcome } from "./withdrawals";

// Runs every handler for the event and records the result. Throws the first failure so the job retries;
// handlers are idempotent, so the ones that already succeeded repeat harmlessly.
export async function processWebhookEvent(db: Db, eventRowId: string) {
  const [row] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, eventRowId));
  if (!row || row.processedAt) return;
  const event = row.payload as PayPalWebhookEvent;
  let failure: unknown;
  for (const handler of handlersFor(row.type)) {
    try {
      await handler(db, event);
    } catch (err) {
      failure ??= err;
    }
  }
  if (failure) {
    const error = failure instanceof Error ? failure.message : String(failure);
    await db.update(webhookEvents).set({ error }).where(eq(webhookEvents.id, eventRowId));
    throw failure;
  }
  await db.update(webhookEvents).set({ processedAt: new Date(), error: null }).where(eq(webhookEvents.id, eventRowId));
}

// Captures whose custom_id is not topup:{id} belong to the escrow handlers.
async function onCaptureCompleted(db: Db, event: PayPalWebhookEvent) {
  const customId = event.resource.custom_id;
  if (typeof customId !== "string" || !customId.startsWith("topup:")) return;
  const amount = event.resource.amount;
  if (amount?.currency_code !== "USD" || typeof amount.value !== "string") {
    throw new Error(`capture ${event.resource.id} has no USD amount`);
  }
  const orderId = event.resource.supplementary_data?.related_ids?.order_id;
  await finishTopup(db, customId.slice("topup:".length), {
    captureId: String(event.resource.id),
    capturedCents: valueToCents(amount.value),
    orderId: typeof orderId === "string" ? orderId : undefined,
  });
}

const ITEM_EVENTS: Record<string, PayoutOutcome> = {
  "PAYMENT.PAYOUTS-ITEM.SUCCEEDED": "succeeded",
  "PAYMENT.PAYOUTS-ITEM.FAILED": "failed",
  "PAYMENT.PAYOUTS-ITEM.RETURNED": "returned",
  "PAYMENT.PAYOUTS-ITEM.CANCELED": "canceled",
  "PAYMENT.PAYOUTS-ITEM.UNCLAIMED": "unclaimed",
};

const str = (v: unknown) => (typeof v === "string" && v ? v : null);

// The payout is found by sender_item_id (our payout id) or PayPal's payout_item_id. Unknown items are ignored.
async function onPayoutItem(db: Db, event: PayPalWebhookEvent) {
  const outcome = ITEM_EVENTS[event.event_type];
  const r = event.resource;
  const senderItemId = str(r.sender_item_id) ?? str(r.payout_item?.sender_item_id);
  const itemId = str(r.payout_item_id);
  const key = senderItemId ? eq(payouts.id, senderItemId) : itemId ? eq(payouts.itemId, itemId) : null;
  if (!outcome || !key) return;
  const [row] = await db.select({ id: payouts.id }).from(payouts).where(key);
  if (row) await applyPayoutOutcome(db, row.id, outcome, { batchId: str(r.payout_batch_id), itemId });
}

registerWebhookHandler("PAYMENT.CAPTURE.COMPLETED", onCaptureCompleted);
for (const type of Object.keys(ITEM_EVENTS)) registerWebhookHandler(type, onPayoutItem);
// Batch status can read SUCCESS while an item is UNCLAIMED, so it never moves money; only item events do.
registerWebhookHandler("PAYMENT.PAYOUTSBATCH.SUCCESS", async () => {});

// Bounty escrow events (authorization created or voided) belong to the arena funding code.
for (const [type, handler] of Object.entries(escrowWebhookHandlers)) registerWebhookHandler(type, handler);
