// Webhook handlers by PayPal event type. Every handler registered for a type runs; each must be idempotent,
// because a failed event is retried and PayPal may redeliver.
import type { Db } from "../../db";
import type { PayPalWebhookEvent } from "../paypal";

// The slice of a pino logger the handlers use (Fastify's request or app logger fits).
export interface WebhookLog {
  warn(fields: Record<string, unknown>, message: string): void;
}

export interface WebhookContext {
  // A warning that does not change the outcome.
  warn(message: string, fields?: Record<string, unknown>): void;
  // The event is acknowledged but deliberately not acted on (e.g. a non-USD amount): logged as a warning and
  // recorded on the stored event as "ignored: <reason>". Retrying would change nothing, so it is not a failure.
  ignore(reason: string, fields?: Record<string, unknown>): void;
}

export type WebhookHandler = (db: Db, event: PayPalWebhookEvent, ctx: WebhookContext) => Promise<void>;

const handlers = new Map<string, WebhookHandler[]>();

export function registerWebhookHandler(eventType: string, handler: WebhookHandler) {
  handlers.set(eventType, [...(handlers.get(eventType) ?? []), handler]);
}

export function handlersFor(eventType: string): WebhookHandler[] {
  return handlers.get(eventType) ?? [];
}
