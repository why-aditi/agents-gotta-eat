// Admin PayPal operations (ops-01): the PayPal call log, stored webhook events, ledger-vs-PayPal reconciliation and
// the Treasurer agent. Cents are JSON integers (signed where noted). Never floats.
import { z } from "zod";

export const AdminCursorQuery = z.object({ cursor: z.string().min(1).max(400).optional() });
export type AdminCursorQuery = z.infer<typeof AdminCursorQuery>;

export const PayPalCallSource = z.enum(["client", "toolkit"]);
export type PayPalCallSource = z.infer<typeof PayPalCallSource>;

// One PayPal HTTP request (each retry attempt too). Never bodies or tokens; `path` keeps query keys only.
export const PayPalCall = z.object({
  id: z.int(),
  method: z.string(),
  path: z.string(),
  // Null for a network error.
  status: z.int().nullable(),
  debugId: z.string().nullable(),
  requestId: z.string().nullable(),
  durationMs: z.int(),
  source: PayPalCallSource,
  createdAt: z.iso.datetime(),
});
export type PayPalCall = z.infer<typeof PayPalCall>;

export const PayPalCallList = z.object({ items: z.array(PayPalCall), nextCursor: z.string().nullable() });
export type PayPalCallList = z.infer<typeof PayPalCallList>;

// A stored PayPal webhook event, without its payload.
export const WebhookEventSummary = z.object({
  id: z.string(),
  paypalEventId: z.string(),
  type: z.string(),
  receivedAt: z.iso.datetime(),
  processedAt: z.iso.datetime().nullable(),
  error: z.string().nullable(),
});
export type WebhookEventSummary = z.infer<typeof WebhookEventSummary>;

export const WebhookEventList = z.object({ items: z.array(WebhookEventSummary), nextCursor: z.string().nullable() });
export type WebhookEventList = z.infer<typeof WebhookEventList>;

export const PAYPAL_RECONCILE_DEFAULT_DAYS = 7;
export const PAYPAL_RECONCILE_MAX_DAYS = 31;

export const PayPalReconcileRequest = z.object({
  days: z.int().min(1).max(PAYPAL_RECONCILE_MAX_DAYS).optional(),
});
export type PayPalReconcileRequest = z.infer<typeof PayPalReconcileRequest>;

export const PayPalReconcileQuery = z.object({ fresh: z.enum(["true", "false"]).optional() });
export type PayPalReconcileQuery = z.infer<typeof PayPalReconcileQuery>;

export const PayPalReconcileStatus = z.enum([
  "matched",
  "missing_in_paypal",
  "missing_in_ledger",
  "amount_mismatch",
  "pending",
]);
export type PayPalReconcileStatus = z.infer<typeof PayPalReconcileStatus>;

// One PayPal id (capture, refund or payout item) and the ledger journals that belong to it.
export const PayPalReconcileLine = z.object({
  status: PayPalReconcileStatus,
  paypalId: z.string(),
  // Signed: positive is money in through PayPal, negative money out. Null when that side has nothing.
  ledgerCents: z.int().nullable(),
  paypalCents: z.int().nullable(),
  journalIds: z.array(z.string()),
  // e.g. "topup:tup_..." or "payout:pay_...".
  refs: z.array(z.string()),
  eventCode: z.string().nullable(),
  at: z.iso.datetime().nullable(),
  detail: z.string(),
});
export type PayPalReconcileLine = z.infer<typeof PayPalReconcileLine>;

export const PayPalReconcileCounts = z.object({
  matched: z.int(),
  missing_in_paypal: z.int(),
  missing_in_ledger: z.int(),
  amount_mismatch: z.int(),
  pending: z.int(),
  // PayPal account activity that isn't ours (no known id, no topup:/bty_ custom id). Not listed.
  unrelated: z.int(),
});
export type PayPalReconcileCounts = z.infer<typeof PayPalReconcileCounts>;

export const PayPalReconcileReport = z.object({
  // True when nothing is missing or mismatched (pending is fine).
  ok: z.boolean(),
  checkedAt: z.iso.datetime(),
  // True when this is the cached result of an earlier run (15 minutes).
  cached: z.boolean(),
  window: z.object({ from: z.iso.datetime(), to: z.iso.datetime(), days: z.int() }),
  counts: PayPalReconcileCounts,
  // Problems first, then pending, then matched.
  lines: z.array(PayPalReconcileLine),
});
export type PayPalReconcileReport = z.infer<typeof PayPalReconcileReport>;

export const TREASURER_QUESTION_MAX = 500;

export const TreasurerAskRequest = z.object({ question: z.string().trim().min(1).max(TREASURER_QUESTION_MAX) });
export type TreasurerAskRequest = z.infer<typeof TreasurerAskRequest>;

export const TreasurerTraceStep = z.object({
  tool: z.string(),
  args: z.record(z.string(), z.unknown()),
  ok: z.boolean(),
  // A short summary of the result, never the raw body.
  summary: z.string(),
});
export type TreasurerTraceStep = z.infer<typeof TreasurerTraceStep>;

export const TreasurerAnswer = z.object({
  // Plain text. Render as text, never as HTML or Markdown.
  answer: z.string(),
  // The ids the answer relied on (PayPal and gottaeat ids).
  cited: z.array(z.string()),
  trace: z.array(TreasurerTraceStep),
  // The gateway model that answered; null for the fallback report.
  model: z.string().nullable(),
  // True when the LLM gateway was unavailable and this is the fixed report.
  fallback: z.boolean(),
});
export type TreasurerAnswer = z.infer<typeof TreasurerAnswer>;
