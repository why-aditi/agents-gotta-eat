import type { PayPalClient } from "./client";
import { centsToValue } from "./cents";

export interface PayPalAuthorization {
  id: string;
  status: string | null;
  expiresAt: string | null;
}

// Omit amountCents to capture the full authorized amount. Always the final capture.
export async function captureAuthorization(
  client: PayPalClient,
  authId: string,
  amountCents: bigint | undefined,
  requestId: string,
): Promise<{ captureId: string; status: string | null }> {
  const body: Record<string, unknown> = { final_capture: true };
  if (amountCents !== undefined) body.amount = { currency_code: "USD", value: centsToValue(amountCents) };
  const raw = await client.request<{ id: string; status?: string }>({
    method: "POST",
    path: `/v2/payments/authorizations/${authId}/capture`,
    body,
    requestId,
  });
  return { captureId: raw.id, status: raw.status ?? null };
}

// Rejects with a PayPalError whose issue is REAUTHORIZATION_TOO_SOON before day 4 of the authorization.
export async function reauthorize(
  client: PayPalClient,
  authId: string,
  requestId: string,
): Promise<PayPalAuthorization> {
  const raw = await client.request<{ id: string; status?: string; expiration_time?: string }>({
    method: "POST",
    path: `/v2/payments/authorizations/${authId}/reauthorize`,
    body: {},
    requestId,
  });
  return { id: raw.id, status: raw.status ?? null, expiresAt: raw.expiration_time ?? null };
}

export async function voidAuthorization(client: PayPalClient, authId: string, requestId: string): Promise<void> {
  await client.request({ method: "POST", path: `/v2/payments/authorizations/${authId}/void`, requestId });
}
