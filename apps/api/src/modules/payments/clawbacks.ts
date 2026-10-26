// PayPal refunds, reversals (chargebacks) and denials of money users paid in (pm-04c).
//
// PAYMENT.CAPTURE.REFUNDED and PAYMENT.CAPTURE.REVERSED carry the refund as the resource: its id is the refund id,
// `amount` is what was taken back (may be partial), and the capture it belongs to is the last path segment of the
// `links` entry with rel "up" (falling back to `capture_id`). PAYMENT.CAPTURE.DENIED carries the capture itself.
// A capture id we don't know is ignored, like an unknown payout item. A payload without the fields we need throws,
// so the stored event records the error and the job retries.
import { eq } from "drizzle-orm";
import type { Db, Tx } from "../../db";
import { topups } from "../../db/schema";
import { reverseEscrowCapture } from "../escrow";
import { publish } from "../events";
import { clawbackTopup, type ClawbackResult } from "../ledger";
import { valueToCents, type PayPalWebhookEvent } from "../paypal";
import { toJsonCents } from "../../lib/cents";

const str = (v: unknown) => (typeof v === "string" && v ? v : null);

// The capture a refund belongs to.
export function refundCaptureId(resource: Record<string, unknown>): string | null {
  const links = Array.isArray(resource.links) ? (resource.links as unknown[]) : [];
  for (const link of links) {
    if (!link || typeof link !== "object") continue;
    const { rel, href } = link as { rel?: unknown; href?: unknown };
    if (rel !== "up" || typeof href !== "string") continue;
    const path = href.split(/[?#]/)[0]!.replace(/\/+$/, "");
    const last = path.slice(path.lastIndexOf("/") + 1);
    if (last) return decodeURIComponent(last);
  }
  return str(resource.capture_id);
}

// USD cents of a resource's amount. Some reversal payloads carry a negative value; what was taken back is its size.
export function refundCents(resource: Record<string, unknown>): bigint {
  const amount = resource.amount as { currency_code?: unknown; value?: unknown } | undefined;
  if (!amount || amount.currency_code !== "USD" || typeof amount.value !== "string") {
    throw new Error(`refund ${String(resource.id)} has no USD amount`);
  }
  const cents = valueToCents(amount.value.replace(/^-/, ""));
  if (cents <= 0n) throw new Error(`refund ${String(resource.id)} has a zero amount`);
  return cents;
}

async function notify(
  conn: Db | Tx,
  ownerId: string,
  source: "topup" | "bounty",
  refId: string,
  title: string | null,
  r: ClawbackResult,
) {
  if (r.clawedCents <= 0n) return;
  await publish(conn, {
    type: "wallet.clawback",
    bountyId: null,
    ownerId,
    data: { source, refId, title, amountCents: toJsonCents(r.clawedCents), owedCents: toJsonCents(r.owedCents) },
  });
}

// Claws back `cents` of a credited top-up, keyed by `key`. Top-ups never credited (created, denied) move nothing.
// `finalStatus` replaces the status once the whole charge is back (refunded), or always (denied).
async function clawTopup(
  db: Db,
  topupId: string,
  cents: bigint | "rest",
  key: string,
  finalStatus: "refunded" | "denied",
): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(topups).where(eq(topups.id, topupId)).for("update");
    if (!row) return;
    const charge = row.amountCents + row.feeCents;
    if (row.status !== "captured" && row.status !== "refunded") {
      if (finalStatus === "denied" && row.status === "created") {
        await tx.update(topups).set({ status: "denied" }).where(eq(topups.id, topupId));
      }
      return;
    }
    const want = cents === "rest" ? charge - row.refundedCents : cents;
    let result: ClawbackResult | null = null;
    if (want > 0n) {
      result = await clawbackTopup(tx, {
        topupId,
        ownerId: row.userId,
        cents: want,
        creditCents: row.amountCents,
        feeCents: row.feeCents,
        alreadyClawedCents: row.refundedCents,
        idempotencyKey: key,
      });
    }
    const refunded = row.refundedCents + (result?.clawedCents ?? 0n);
    const status = finalStatus === "denied" ? "denied" : refunded >= charge ? "refunded" : row.status;
    if (refunded !== row.refundedCents || status !== row.status) {
      await tx.update(topups).set({ refundedCents: refunded, status }).where(eq(topups.id, topupId));
    }
    if (result) await notify(tx, row.userId, "topup", topupId, null, result);
  });
}

// PAYMENT.CAPTURE.REFUNDED and PAYMENT.CAPTURE.REVERSED.
export async function onCaptureRefunded(db: Db, event: PayPalWebhookEvent) {
  const r = event.resource;
  const refundId = str(r.id);
  const captureId = refundCaptureId(r);
  if (!refundId || !captureId) throw new Error(`${event.event_type} ${event.id} names no refund or capture`);

  const [topup] = await db.select({ id: topups.id }).from(topups).where(eq(topups.captureId, captureId));
  if (topup) {
    await clawTopup(db, topup.id, refundCents(r), `clawback:${refundId}`, "refunded");
    return;
  }
  // Not a top-up: maybe a bounty's escrow capture. Unknown captures are ignored.
  await reverseEscrowCapture(db, { captureId, refundId, cents: () => refundCents(r) });
}

// PAYMENT.CAPTURE.DENIED: a pending top-up capture failed. Nothing was credited (only COMPLETED credits); if it
// somehow was, the whole charge is clawed back.
export async function onCaptureDenied(db: Db, event: PayPalWebhookEvent) {
  const r = event.resource;
  const captureId = str(r.id);
  const customId = str(r.custom_id);
  let topupId = customId?.startsWith("topup:") ? customId.slice("topup:".length) : null;
  if (!topupId && captureId) {
    const [row] = await db.select({ id: topups.id }).from(topups).where(eq(topups.captureId, captureId));
    topupId = row?.id ?? null;
  }
  if (!topupId) return;
  await clawTopup(db, topupId, "rest", `clawback:denied:${captureId ?? topupId}`, "denied");
}
