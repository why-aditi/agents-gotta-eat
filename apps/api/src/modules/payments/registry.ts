// Webhook handlers by PayPal event type. Every handler registered for a type runs; each must be idempotent,
// because a failed event is retried and PayPal may redeliver.
import type { Db } from "../../db";
import type { PayPalWebhookEvent } from "../paypal";

export type WebhookHandler = (db: Db, event: PayPalWebhookEvent) => Promise<void>;

const handlers = new Map<string, WebhookHandler[]>();

export function registerWebhookHandler(eventType: string, handler: WebhookHandler) {
  handlers.set(eventType, [...(handlers.get(eventType) ?? []), handler]);
}

export function handlersFor(eventType: string): WebhookHandler[] {
  return handlers.get(eventType) ?? [];
}
