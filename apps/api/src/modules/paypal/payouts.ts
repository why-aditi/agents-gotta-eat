import type { PayPalClient } from "./client";
import { centsToValue, valueToCents } from "./cents";

export interface PayoutItemInput {
  senderItemId: string;
  email: string;
  amountCents: bigint;
  note?: string;
}

export interface PayoutItemStatus {
  payoutItemId: string | null;
  senderItemId: string | null;
  status: string | null;
  amountCents: bigint | null;
  errors: unknown;
}

export interface PayoutBatch {
  batchId: string;
  status: string;
  items: PayoutItemStatus[];
}

interface RawBatch {
  batch_header: { payout_batch_id: string; batch_status: string };
  items?: {
    payout_item_id?: string;
    transaction_status?: string;
    errors?: unknown;
    payout_item?: { sender_item_id?: string; amount?: { value: string } };
  }[];
}

function toBatch(raw: RawBatch): PayoutBatch {
  return {
    batchId: raw.batch_header.payout_batch_id,
    status: raw.batch_header.batch_status,
    items: (raw.items ?? []).map((i) => ({
      payoutItemId: i.payout_item_id ?? null,
      senderItemId: i.payout_item?.sender_item_id ?? null,
      status: i.transaction_status ?? null,
      amountCents: i.payout_item?.amount ? valueToCents(i.payout_item.amount.value) : null,
      errors: i.errors ?? null,
    })),
  };
}

export async function createPayoutBatch(
  client: PayPalClient,
  args: { senderBatchId: string; items: PayoutItemInput[]; requestId: string },
): Promise<PayoutBatch> {
  const raw = await client.request<RawBatch>({
    method: "POST",
    path: "/v1/payments/payouts",
    requestId: args.requestId,
    body: {
      sender_batch_header: { sender_batch_id: args.senderBatchId, email_subject: "You have a payout from gottaeat" },
      items: args.items.map((i) => ({
        recipient_type: "EMAIL",
        receiver: i.email,
        amount: { value: centsToValue(i.amountCents), currency: "USD" },
        sender_item_id: i.senderItemId,
        note: i.note ?? "gottaeat payout",
      })),
    },
  });
  return toBatch(raw);
}

export async function getPayoutBatch(client: PayPalClient, batchId: string): Promise<PayoutBatch> {
  return toBatch(await client.request<RawBatch>({ method: "GET", path: `/v1/payments/payouts/${batchId}` }));
}
