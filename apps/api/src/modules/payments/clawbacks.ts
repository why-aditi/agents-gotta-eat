// PayPal refunds, reversals (chargebacks) and denials of money users paid in (pm-04c).
//
// PAYMENT.CAPTURE.REFUNDED and PAYMENT.CAPTURE.REVERSED carry the refund as the resource: its id is the refund id
// and `amount` is what was taken back (may be partial). PAYMENT.CAPTURE.DENIED carries the capture itself.
// Two payload shapes arrive: live events use the v2 resource (`amount.value` / `amount.currency_code`, a `links`
// entry with rel "up" naming /v2/payments/captures/{id}); PayPal's webhook simulator sends the legacy v1 resource
// (`amount.total` / `amount.currency`, `sale_id` and `parent_payment`, no "up" link, totals that may be negative).
// Both are read (see webhookAmount and refundCaptureId).
//
// We are USD only: a non-USD event is acknowledged and recorded as ignored (throwing would only retry it). An
// event naming no capture is ignored the same way, and a capture id we don't know is logged and skipped, like an
// unknown payout item. A known capture with an unreadable amount throws, so the stored event records the error
// and the job retries.
import { eq } from "drizzle-orm";
import type { Db, Tx } from "../../db";
import { topups } from "../../db/schema";
import { reverseEscrowCapture } from "../escrow";
import { publish } from "../events";
import { clawbackTopup, type ClawbackResult } from "../ledger";
import { valueToCents, type PayPalWebhookEvent } from "../paypal";
import { toJsonCents } from "../../lib/cents";
import type { WebhookContext } from "./registry";

const str = (v: unknown) => (typeof v === "string" && v ? v : null);

// A link's path, without query, fragment or trailing slash.
const hrefPath = (href: string) => href.split(/[?#]/)[0]!.replace(/\/+$/, "");
// A v2 capture or a v1 sale (the same id): /v2/payments/captures/{id}, /v1/payments/sale/{id}.
const CAPTURE_LINK = /\/payments\/(?:captures|sale)\/([^/]+)$/;

// The capture a refund or reversal belongs to: the "up" link, else a link naming a capture or sale, else the
// capture_id, sale_id or parent_payment field, in that order.
export function refundCaptureId(resource: Record<string, unknown>): string | null {
  const links = (Array.isArray(resource.links) ? (resource.links as unknown[]) : []).flatMap((link) => {
    if (!link || typeof link !== "object") return [];
    const { rel, href } = link as { rel?: unknown; href?: unknown };
    return typeof href === "string" ? [{ rel, path: hrefPath(href) }] : [];
  });
  for (const { rel, path } of links) {
    if (rel !== "up") continue;
    const last = path.slice(path.lastIndexOf("/") + 1);
    if (last) return decodeURIComponent(last);
  }
  for (const { path } of links) {
    const m = CAPTURE_LINK.exec(path);
    if (m) return decodeURIComponent(m[1]!);
  }
  return str(resource.capture_id) ?? str(resource.sale_id) ?? str(resource.parent_payment);
}

export type WebhookAmount = { kind: "usd"; cents: bigint } | { kind: "other"; currency: string } | { kind: "missing" };

// A resource's amount in either shape: v2 { value, currency_code } or v1 { total, currency }. Parsed by string to
// integer cents. A sign is dropped: some reversal and v1 refund payloads carry a negative value, and what was
// taken back is its size.
export function webhookAmount(resource: Record<string, unknown>): WebhookAmount {
  const a = resource.amount as
    { value?: unknown; total?: unknown; currency_code?: unknown; currency?: unknown } | null | undefined;
  if (!a || typeof a !== "object") return { kind: "missing" };
  const currency = a.currency_code ?? a.currency;
  if (typeof currency === "string" && currency !== "USD") return { kind: "other", currency };
  const value = a.value ?? a.total;
  if (currency !== "USD" || typeof value !== "string") return { kind: "missing" };
  try {
    return { kind: "usd", cents: valueToCents(value.replace(/^-/, "")) };
  } catch {
    return { kind: "missing" };
  }
}

// USD cents of a refund's amount; throws when it is missing, unreadable or zero.
export function refundCents(resource: Record<string, unknown>): bigint {
  const amount = webhookAmount(resource);
  if (amount.kind !== "usd") throw new Error(`refund ${String(resource.id)} has no USD amount`);
  if (amount.cents <= 0n) throw new Error(`refund ${String(resource.id)} has a zero amount`);
  return amount.cents;
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
export async function onCaptureRefunded(db: Db, event: PayPalWebhookEvent, ctx: WebhookContext) {
  const r = event.resource;
  const refundId = str(r.id);
  const captureId = refundCaptureId(r);
  const fields = { eventId: event.id, eventType: event.event_type, refundId, captureId };
  const amount = webhookAmount(r);
  if (amount.kind === "other") return ctx.ignore(`${amount.currency} amount; we are USD only`, fields);
  if (!captureId) return ctx.ignore("names no capture", fields);
  // The refund id keys the clawback journal; without one nothing can be moved exactly once.
  if (!refundId) return ctx.ignore("names no refund id", fields);

  const [topup] = await db.select({ id: topups.id }).from(topups).where(eq(topups.captureId, captureId));
  if (topup) {
    await clawTopup(db, topup.id, refundCents(r), `clawback:${refundId}`, "refunded");
    return;
  }
  // Not a top-up: maybe a bounty's escrow capture. Unknown captures are logged and skipped.
  const known = await reverseEscrowCapture(db, { captureId, refundId, cents: () => refundCents(r) });
  if (!known) ctx.warn("refund or reversal of a capture we don't know", fields);
}

// PAYMENT.CAPTURE.DENIED: a pending top-up capture failed. Nothing was credited (only COMPLETED credits); if it
// somehow was, the whole charge is clawed back.
export async function onCaptureDenied(db: Db, event: PayPalWebhookEvent, ctx: WebhookContext) {
  const r = event.resource;
  const captureId = str(r.id);
  const customId = str(r.custom_id);
  const fields = { eventId: event.id, eventType: event.event_type, captureId };
  const amount = webhookAmount(r);
  if (amount.kind === "other") return ctx.ignore(`${amount.currency} amount; we are USD only`, fields);
  let topupId = customId?.startsWith("topup:") ? customId.slice("topup:".length) : null;
  if (!topupId && captureId) {
    const [row] = await db.select({ id: topups.id }).from(topups).where(eq(topups.captureId, captureId));
    topupId = row?.id ?? null;
  }
  if (!topupId) {
    ctx.warn("denied capture we don't know", fields);
    return;
  }
  await clawTopup(db, topupId, "rest", `clawback:denied:${captureId ?? topupId}`, "denied");
}
