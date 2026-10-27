"use server";

// Read-only admin loads for client components: the next page of journals, one journal's lines, the next page of
// PayPal calls or webhook events, the PayPal reconciliation and the Treasurer. None moves money, so none sends an
// Idempotency-Key. The api checks the admin role on every call.
import {
  AdminJournalDetail,
  AdminJournalList,
  PayPalCallList,
  PayPalReconcileReport,
  TreasurerAnswer,
  TreasurerAskRequest,
  WebhookEventList,
} from "@gottaeat/schemas";
import { type ActionResult, runAction } from "@/lib/actions";
import { apiFetch } from "@/lib/api";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const CURSOR_RE = /^[A-Za-z0-9_-]{1,400}$/;
const invalid = (message: string) => ({ ok: false as const, code: "validation_failed", message });

export async function loadJournals(cursor: string): Promise<ActionResult<AdminJournalList>> {
  if (!CURSOR_RE.test(cursor)) return invalid("Invalid page cursor. Reload the page.");
  return runAction(() =>
    apiFetch(AdminJournalList, `/v1/admin/journals?limit=100&cursor=${encodeURIComponent(cursor)}`),
  );
}

export async function loadJournal(id: string): Promise<ActionResult<AdminJournalDetail>> {
  if (!ID_RE.test(id)) return invalid("Unknown journal.");
  return runAction(() => apiFetch(AdminJournalDetail, `/v1/admin/journals/${encodeURIComponent(id)}`));
}

export async function loadPayPalCalls(cursor: string): Promise<ActionResult<PayPalCallList>> {
  if (!/^[1-9]\d{0,17}$/.test(cursor)) return invalid("Invalid page cursor. Reload the page.");
  return runAction(() => apiFetch(PayPalCallList, `/v1/admin/paypal/calls?cursor=${cursor}`));
}

export async function loadWebhookEvents(cursor: string): Promise<ActionResult<WebhookEventList>> {
  if (!CURSOR_RE.test(cursor)) return invalid("Invalid page cursor. Reload the page.");
  return runAction(() => apiFetch(WebhookEventList, `/v1/admin/paypal/webhooks?cursor=${encodeURIComponent(cursor)}`));
}

// `fresh` skips the api's 15-minute cache.
export async function runPayPalReconcile(fresh: boolean): Promise<ActionResult<PayPalReconcileReport>> {
  return runAction(() =>
    apiFetch(PayPalReconcileReport, `/v1/admin/reconcile/paypal${fresh ? "?fresh=true" : ""}`, { body: {} }),
  );
}

export async function askTreasurer(question: string): Promise<ActionResult<TreasurerAnswer>> {
  const body = TreasurerAskRequest.safeParse({ question });
  if (!body.success) return invalid("Ask a question of at most 500 characters.");
  return runAction(() => apiFetch(TreasurerAnswer, "/v1/admin/treasurer/ask", { body: body.data }));
}
