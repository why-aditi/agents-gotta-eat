// Background work: webhook processing, payout sending and the late-webhook poll. The functions are plain
// async functions; pg-boss only schedules and retries them. Without a queue (tests, or PayPal unconfigured)
// they run inline, so callers see the work finished.
import { and, inArray, lt } from "drizzle-orm";
import { PgBoss } from "pg-boss";
import type { Db } from "../../db";
import { payouts } from "../../db/schema";
import { getPayoutBatch, requirePayPal } from "../paypal";
import { processWebhookEvent } from "./webhooks";
import { applyPayoutOutcome, sendPayout, type PayoutOutcome } from "./withdrawals";

export interface PaymentQueue {
  webhook(eventRowId: string): Promise<void>;
  payout(payoutId: string): Promise<void>;
}

let queue: PaymentQueue | null = null;
// null (the default) runs jobs inline.
export function setPaymentQueue(q: PaymentQueue | null) {
  queue = q;
}

export const enqueueWebhook = (db: Db, eventRowId: string) =>
  queue ? queue.webhook(eventRowId) : processWebhookEvent(db, eventRowId);
export const enqueuePayout = (db: Db, payoutId: string) => (queue ? queue.payout(payoutId) : sendPayout(db, payoutId));

const POLL_AFTER_MS = 5 * 60_000;

const ITEM_STATUS: Record<string, PayoutOutcome> = {
  SUCCESS: "succeeded",
  FAILED: "failed",
  BLOCKED: "failed",
  DENIED: "failed",
  RETURNED: "returned",
  CANCELED: "canceled",
  UNCLAIMED: "unclaimed",
};

// Payouts still waiting after 5 minutes: unsent ones are sent (same request id), sent ones are looked up
// at PayPal and get the transition their item status implies. Returns how many payouts it looked at.
export async function pollPayouts(db: Db, now: Date): Promise<number> {
  const stale = await db
    .select()
    .from(payouts)
    .where(
      and(
        inArray(payouts.status, ["pending", "unclaimed"]),
        lt(payouts.createdAt, new Date(now.getTime() - POLL_AFTER_MS)),
      ),
    );
  let failure: unknown;
  const batches = new Map<string, string[]>();
  for (const p of stale) {
    if (p.paypalBatchId) {
      batches.set(p.paypalBatchId, [...(batches.get(p.paypalBatchId) ?? []), p.id]);
      continue;
    }
    try {
      await sendPayout(db, p.id);
    } catch (err) {
      failure ??= err;
    }
  }
  for (const [batchId, ids] of batches) {
    try {
      const batch = await getPayoutBatch(requirePayPal(), batchId);
      for (const item of batch.items) {
        const outcome = item.status ? ITEM_STATUS[item.status] : undefined;
        if (outcome && item.senderItemId && ids.includes(item.senderItemId)) {
          await applyPayoutOutcome(db, item.senderItemId, outcome, { batchId, itemId: item.payoutItemId });
        }
      }
    } catch (err) {
      failure ??= err;
    }
  }
  if (failure) throw failure;
  return stale.length;
}

// Starts pg-boss on the same database (2 connections, its own schema). Resolves to a stop function.
export async function startPaymentJobs(db: Db, databaseUrl: string, onError: (err: unknown) => void) {
  const boss = new PgBoss({ connectionString: databaseUrl, max: 2, schema: "pgboss" });
  boss.on("error", onError);
  await boss.start();
  const retry = { retryLimit: 8, retryDelay: 30, retryBackoff: true };
  for (const name of ["webhook.process", "payout.send", "payout.poll"]) await boss.createQueue(name, retry);

  await boss.work<{ eventId: string }>("webhook.process", async (jobs) => {
    for (const job of jobs) await processWebhookEvent(db, job.data.eventId);
  });
  await boss.work<{ payoutId: string }>("payout.send", async (jobs) => {
    for (const job of jobs) await sendPayout(db, job.data.payoutId);
  });
  await boss.work("payout.poll", async () => {
    await pollPayouts(db, new Date());
  });
  await boss.schedule("payout.poll", "*/5 * * * *");

  setPaymentQueue({
    webhook: async (eventId) => void (await boss.send("webhook.process", { eventId })),
    payout: async (payoutId) => void (await boss.send("payout.send", { payoutId })),
  });
  return async () => {
    setPaymentQueue(null);
    await boss.stop();
  };
}
