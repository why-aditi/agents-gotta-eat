import type { PayPalClient } from "./client";

type Headers = Record<string, string | string[] | undefined>;

const HEADER_FIELDS = {
  "paypal-auth-algo": "auth_algo",
  "paypal-cert-url": "cert_url",
  "paypal-transmission-id": "transmission_id",
  "paypal-transmission-sig": "transmission_sig",
  "paypal-transmission-time": "transmission_time",
} as const;

// True only when PayPal answers verification_status SUCCESS. Missing headers or an unparseable body are false.
// An API failure throws (the caller should answer 5xx so PayPal redelivers); it never returns true.
export async function verifyWebhook(
  client: PayPalClient,
  args: { headers: Headers; rawBody: string; webhookId: string },
): Promise<boolean> {
  const body: Record<string, unknown> = { webhook_id: args.webhookId };
  for (const [header, field] of Object.entries(HEADER_FIELDS)) {
    const v = args.headers[header];
    const value = Array.isArray(v) ? v[0] : v;
    if (!value) return false;
    body[field] = value;
  }
  try {
    body.webhook_event = JSON.parse(args.rawBody);
  } catch {
    return false;
  }
  const res = await client.request<{ verification_status?: string }>({
    method: "POST",
    path: "/v1/notifications/verify-webhook-signature",
    body,
  });
  return res.verification_status === "SUCCESS";
}

// The slice of a PayPal webhook event our handlers read. Resource shapes differ per event type.
export interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  create_time?: string;
  resource: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}
