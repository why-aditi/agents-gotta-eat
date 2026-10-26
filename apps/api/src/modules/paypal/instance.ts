// The process-wide PayPal client. server.ts configures it from env; with no credentials it stays null
// and every PayPal route answers 503 paypal_not_configured, while dev stand-ins keep working.
import { ApiError } from "../../http/errors";
import type { PayPalClient } from "./client";

let current: PayPalClient | null = null;

export function configurePayPal(client: PayPalClient | null) {
  current = client;
}

export function getPayPal(): PayPalClient | null {
  return current;
}

export function requirePayPal(): PayPalClient {
  if (!current) throw new ApiError("paypal_not_configured");
  return current;
}
