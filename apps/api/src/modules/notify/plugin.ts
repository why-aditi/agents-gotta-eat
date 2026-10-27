// Email triggers. Events are committed rows, so a rolled-back spend or dispute sends nothing. The listener only
// enqueues; a failing queue or send is logged and never reaches the event bus.
import { EventData } from "@gottaeat/schemas";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { EventRow } from "../events";
import { type EmailJob, enqueueEmail, jobKey } from "./jobs";
import { notifyConfigFromEnv } from "./send";

// dispute.opened (disp-01) is read by the one field the email needs. It is emitted once per party (poster and
// winner's owner), so one dispute can arrive as two events.
const DisputeOpened = z.object({ disputeId: z.string().min(1) });

export function emailJobFor(row: Pick<EventRow, "type" | "data">): EmailJob | null {
  if (row.type === "spend.decided") {
    const data = EventData["spend.decided"].safeParse(row.data);
    if (data.success && data.data.decision === "pending_approval") {
      return { kind: "approval", spendRequestId: data.data.spendRequestId };
    }
    return null;
  }
  if (row.type === "dispute.opened") {
    const data = DisputeOpened.safeParse(row.data);
    return data.success ? { kind: "dispute", disputeId: data.data.disputeId } : null;
  }
  return null;
}

// Keys this process already enqueued, so repeated events make one job. Bounded; pg-boss's singletonKey and
// Resend's Idempotency-Key catch whatever falls out of it.
const SEEN_MAX = 1000;

export const notifyPlugin: FastifyPluginAsync = async (api) => {
  const cfg = notifyConfigFromEnv(api.env);
  const seen = new Set<string>();
  const stop = api.eventBus.subscribe((row) => {
    const job = emailJobFor(row);
    if (!job) return;
    const key = jobKey(job);
    if (seen.has(key)) return;
    seen.add(key);
    if (seen.size > SEEN_MAX) seen.delete(seen.values().next().value as string);
    enqueueEmail(api.db, cfg, job).catch((err: unknown) => api.log.error({ err, job }, "email job failed"));
  });
  api.addHook("onClose", async () => stop());
};
