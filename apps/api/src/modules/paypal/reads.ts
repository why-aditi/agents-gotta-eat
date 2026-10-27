// Read-only PayPal lookups for reconciliation and the Treasurer: a capture, an authorization, a payout item and
// the transaction search (reporting). Amounts become bigint cents; free text PayPal echoes back (notes, names) is
// dropped except custom_id / custom_field, which are ours.
import type { PayPalClient } from "./client";
import { signedValueToCents, valueToCents } from "./cents";

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

function usdCents(amount: unknown, signed = false): bigint | null {
  const a = amount as { value?: unknown; currency_code?: unknown; currency?: unknown } | undefined;
  if (!a || typeof a.value !== "string") return null;
  const currency = a.currency_code ?? a.currency;
  if (currency !== undefined && currency !== "USD") return null;
  try {
    return signed ? signedValueToCents(a.value) : valueToCents(a.value);
  } catch {
    return null;
  }
}

export interface PayPalCapture {
  id: string;
  status: string | null;
  amountCents: bigint | null;
  customId: string | null;
  orderId: string | null;
  createTime: string | null;
  updateTime: string | null;
}

export async function getCapture(client: PayPalClient, captureId: string): Promise<PayPalCapture> {
  const raw = await client.request<Record<string, unknown>>({
    method: "GET",
    path: `/v2/payments/captures/${encodeURIComponent(captureId)}`,
  });
  const related = (raw.supplementary_data as { related_ids?: { order_id?: unknown } } | undefined)?.related_ids;
  return {
    id: String(raw.id),
    status: str(raw.status),
    amountCents: usdCents(raw.amount),
    customId: str(raw.custom_id),
    orderId: str(related?.order_id),
    createTime: str(raw.create_time),
    updateTime: str(raw.update_time),
  };
}

export interface PayPalAuthorizationDetail {
  id: string;
  status: string | null;
  amountCents: bigint | null;
  customId: string | null;
  expiresAt: string | null;
}

export async function getAuthorization(client: PayPalClient, authId: string): Promise<PayPalAuthorizationDetail> {
  const raw = await client.request<Record<string, unknown>>({
    method: "GET",
    path: `/v2/payments/authorizations/${encodeURIComponent(authId)}`,
  });
  return {
    id: String(raw.id),
    status: str(raw.status),
    amountCents: usdCents(raw.amount),
    customId: str(raw.custom_id),
    expiresAt: str(raw.expiration_time),
  };
}

export interface PayPalPayoutItem {
  payoutItemId: string;
  transactionId: string | null;
  batchId: string | null;
  status: string | null;
  senderItemId: string | null;
  amountCents: bigint | null;
}

export async function getPayoutItem(client: PayPalClient, itemId: string): Promise<PayPalPayoutItem> {
  const raw = await client.request<Record<string, unknown>>({
    method: "GET",
    path: `/v1/payments/payouts-item/${encodeURIComponent(itemId)}`,
  });
  const item = (raw.payout_item ?? {}) as { sender_item_id?: unknown; amount?: unknown };
  return {
    payoutItemId: String(raw.payout_item_id ?? itemId),
    transactionId: str(raw.transaction_id),
    batchId: str(raw.payout_batch_id),
    status: str(raw.transaction_status),
    senderItemId: str(item.sender_item_id),
    amountCents: usdCents(item.amount),
  };
}

// One row of the transaction search. amountCents is signed: positive is money in, negative money out.
export interface PayPalTransaction {
  id: string;
  eventCode: string | null;
  status: string | null;
  amountCents: bigint | null;
  customField: string | null;
  referenceId: string | null;
  initiatedAt: string | null;
}

export interface TransactionPage {
  transactions: PayPalTransaction[];
  page: number;
  totalPages: number;
}

// Parses a /v1/reporting/transactions answer (also what the toolkit's list_transactions returns).
export function toTransactionPage(raw: unknown, page: number): TransactionPage {
  const r = (raw ?? {}) as { transaction_details?: unknown; total_pages?: unknown; page?: unknown };
  const details = Array.isArray(r.transaction_details) ? r.transaction_details : [];
  const transactions: PayPalTransaction[] = [];
  for (const d of details) {
    const info = (d as { transaction_info?: Record<string, unknown> } | null)?.transaction_info;
    const id = str(info?.transaction_id);
    if (!info || !id) continue;
    transactions.push({
      id,
      eventCode: str(info.transaction_event_code),
      status: str(info.transaction_status),
      amountCents: usdCents(info.transaction_amount, true),
      customField: str(info.custom_field),
      referenceId: str(info.paypal_reference_id),
      initiatedAt: str(info.transaction_initiation_date),
    });
  }
  const totalPages = typeof r.total_pages === "number" && r.total_pages >= 1 ? Math.trunc(r.total_pages) : 1;
  return { transactions, page: typeof r.page === "number" ? r.page : page, totalPages };
}

// PayPal wants ISO 8601 with seconds and no fractional part in some regions; strip the milliseconds.
export const isoSeconds = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
// The end of a search window, rounded up to the next whole second so nothing in its last second is cut off.
export const isoSecondsCeil = (d: Date) => isoSeconds(new Date(Math.ceil(d.getTime() / 1000) * 1000));

export async function listTransactionsDirect(
  client: PayPalClient,
  args: { start: Date; end: Date; page?: number },
): Promise<TransactionPage> {
  const page = args.page ?? 1;
  const q = new URLSearchParams({
    start_date: isoSeconds(args.start),
    end_date: isoSecondsCeil(args.end),
    transaction_status: "S",
    fields: "transaction_info",
    page_size: "500",
    page: String(page),
  });
  const raw = await client.request({ method: "GET", path: `/v1/reporting/transactions?${q.toString()}` });
  return toTransactionPage(raw, page);
}
