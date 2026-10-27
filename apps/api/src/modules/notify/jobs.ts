// The notify.email job: load the facts, render, send. pg-boss only schedules and retries it (3 times, with
// backoff); the job key is both the pg-boss singletonKey and Resend's Idempotency-Key, so a retry or a duplicate
// event never sends twice. Without a queue (tests, or email off) the job runs inline.
import { PgBoss } from "pg-boss";
import type { Db } from "../../db";
import { approvalFacts, disputeFacts } from "./facts";
import { approvalEmail, disputeEmail } from "./render";
import { type NotifyConfig, sendEmail } from "./send";

export type EmailJob = { kind: "approval"; spendRequestId: string } | { kind: "dispute"; disputeId: string };

export const NOTIFY_QUEUE = "notify.email";

export function jobKey(job: EmailJob): string {
  return job.kind === "approval" ? `approval:${job.spendRequestId}` : `dispute:${job.disputeId}`;
}

// Sends what the job describes. Resolves to how many emails Resend accepted (0 when email is off or there is
// nothing left to say). Throws on a send failure, after the emails before it went out.
export async function runEmailJob(db: Db, cfg: NotifyConfig, job: EmailJob): Promise<number> {
  if (!cfg.apiKey) return 0;
  const key = jobKey(job);
  if (job.kind === "approval") {
    const facts = await approvalFacts(db, job.spendRequestId);
    if (!facts) return 0;
    const sent = await sendEmail(cfg, {
      to: facts.ownerEmail,
      idempotencyKey: key,
      ...approvalEmail(facts, cfg.webUrl),
    });
    return sent ? 1 : 0;
  }
  const facts = await disputeFacts(db, job.disputeId);
  if (!facts) return 0;
  const email = disputeEmail(facts, cfg.webUrl);
  let sent = 0;
  // One email per admin, each with its own key: a retry re-sends only the ones Resend hasn't accepted.
  for (const admin of facts.admins) {
    if (await sendEmail(cfg, { to: admin.email, idempotencyKey: `${key}:${admin.userId}`, ...email })) sent += 1;
  }
  return sent;
}

export interface NotifyQueue {
  email(job: EmailJob): Promise<void>;
}

let queue: NotifyQueue | null = null;
// null (the default) runs jobs inline.
export function setNotifyQueue(q: NotifyQueue | null) {
  queue = q;
}

export const enqueueEmail = async (db: Db, cfg: NotifyConfig, job: EmailJob): Promise<void> =>
  queue ? queue.email(job) : void (await runEmailJob(db, cfg, job));

// Starts pg-boss on the same database (2 connections, its own schema). Resolves to a stop function.
export async function startNotifyJobs(
  db: Db,
  databaseUrl: string,
  cfg: NotifyConfig,
  onError: (err: unknown) => void,
): Promise<() => Promise<void>> {
  const boss = new PgBoss({ connectionString: databaseUrl, max: 2, schema: "pgboss" });
  boss.on("error", onError);
  await boss.start();
  // "short": at most one queued job per singletonKey, so a repeated event doesn't queue a second email.
  await boss.createQueue(NOTIFY_QUEUE, { policy: "short", retryLimit: 3, retryDelay: 30, retryBackoff: true });
  await boss.work<EmailJob>(NOTIFY_QUEUE, async (jobs) => {
    for (const job of jobs) await runEmailJob(db, cfg, job.data);
  });
  setNotifyQueue({
    email: async (job) => void (await boss.send(NOTIFY_QUEUE, job, { singletonKey: jobKey(job) })),
  });
  return async () => {
    setNotifyQueue(null);
    await boss.stop();
  };
}
