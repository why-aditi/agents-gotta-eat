import type { PayPalClient } from "./client";
import { centsToValue, valueToCents } from "./cents";

interface RawOrder {
  id: string;
  status: string;
  purchase_units?: {
    custom_id?: string;
    amount?: { value: string };
    payments?: {
      authorizations?: { id: string; expiration_time?: string }[];
      captures?: { id: string; status?: string; amount?: { value: string } }[];
    };
  }[];
}

export interface PayPalOrder {
  id: string;
  status: string;
  customId: string | null;
  amountCents: bigint | null;
  authorizationId: string | null;
  authorizationExpiresAt: string | null;
  captureId: string | null;
  // COMPLETED once the money has settled; PENDING (e-check, review) means it has not yet.
  captureStatus: string | null;
  capturedCents: bigint | null;
}

function toOrder(raw: RawOrder): PayPalOrder {
  const unit = raw.purchase_units?.[0];
  const auth = unit?.payments?.authorizations?.[0];
  const capture = unit?.payments?.captures?.[0];
  return {
    id: raw.id,
    status: raw.status,
    customId: unit?.custom_id ?? null,
    amountCents: unit?.amount ? valueToCents(unit.amount.value) : null,
    authorizationId: auth?.id ?? null,
    authorizationExpiresAt: auth?.expiration_time ?? null,
    captureId: capture?.id ?? null,
    captureStatus: capture?.status ?? null,
    capturedCents: capture?.amount ? valueToCents(capture.amount.value) : null,
  };
}

export async function createOrder(
  client: PayPalClient,
  args: { intent: "AUTHORIZE" | "CAPTURE"; amountCents: bigint; customId: string; requestId: string },
): Promise<PayPalOrder> {
  const raw = await client.request<RawOrder>({
    method: "POST",
    path: "/v2/checkout/orders",
    requestId: args.requestId,
    body: {
      intent: args.intent,
      purchase_units: [
        {
          custom_id: args.customId,
          amount: { currency_code: "USD", value: centsToValue(args.amountCents) },
        },
      ],
      payment_source: {
        paypal: { experience_context: { user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING" } },
      },
    },
  });
  return toOrder(raw);
}

export async function authorizeOrder(client: PayPalClient, orderId: string, requestId: string): Promise<PayPalOrder> {
  return toOrder(
    await client.request<RawOrder>({ method: "POST", path: `/v2/checkout/orders/${orderId}/authorize`, requestId }),
  );
}

export async function captureOrder(client: PayPalClient, orderId: string, requestId: string): Promise<PayPalOrder> {
  return toOrder(
    await client.request<RawOrder>({ method: "POST", path: `/v2/checkout/orders/${orderId}/capture`, requestId }),
  );
}

export async function getOrder(client: PayPalClient, orderId: string): Promise<PayPalOrder> {
  return toOrder(await client.request<RawOrder>({ method: "GET", path: `/v2/checkout/orders/${orderId}` }));
}
