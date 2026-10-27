// Email triggers end to end: a committed event → a job with the right key → the email at a fake Resend.
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildTestApp,
  createSpendFixture,
  createTestBounty,
  createTestDb,
  createUser,
  resetDb,
} from "../../../test/db";
import { type FakeResend, startFakeResend } from "../../../test/fake-resend";
import type { AppEnv } from "../../app";
import { disputes, events, spendRequests, users } from "../../db/schema";
import { newId } from "../../lib/ids";
import { createSpendRequest, stubIntentCheck } from "../policy";
import { type EmailJob, jobKey, notifyConfigFromEnv, runEmailJob, setNotifyQueue } from "./index";

const { db, pool } = createTestDb();
let resend: FakeResend;
let app: ReturnType<typeof buildTestApp> | undefined;

beforeAll(async () => {
  resend = await startFakeResend();
});
afterAll(async () => {
  await resend.close();
  await pool.end();
});
beforeEach(async () => {
  await resetDb(db);
  resend.requests.length = 0;
});
afterEach(async () => {
  setNotifyQueue(null);
  await app?.close();
  app = undefined;
});

const WEB_URL = "https://web.example";
const emailEnv = (): Partial<AppEnv> => ({ RESEND_API_KEY: "re_test", RESEND_API_URL: resend.url, WEB_URL });

async function startApp(env: Partial<AppEnv>) {
  app = buildTestApp(db, env);
  await app.ready();
  // The bus starts from the newest event; ready it first so the events below are delivered.
  await app.eventBus.ready();
  return app;
}

const allow = { intentCheck: stubIntentCheck("allow") };

// askAboveCents 50: a 100-cent tool spend asks the owner, a 10-cent one is allowed, 5000 is over the per-tx cap.
async function spend(amountCents: number, reason = "API credits") {
  const f = await createSpendFixture(db, { balanceCents: 5000n, rules: { askAboveCents: 50 } });
  const res = await createSpendRequest(
    db,
    f.principal,
    { amountCents, category: "tool", reason, payeeAgentId: f.payeeAgentId },
    allow,
  );
  return { ...f, res };
}

async function makeAdmin(): Promise<string> {
  const id = await createUser(db);
  await db
    .update(users)
    .set({ roles: ["admin"] })
    .where(eq(users.id, id));
  return id;
}

// A dispute row and its dispute.opened events (one per party, as disp-01 emits them), inserted directly.
async function openDispute(reason = "The winner's answer is wrong") {
  const posterId = await createUser(db);
  const winnerOwnerId = await createUser(db);
  const bountyId = await createTestBounty(db, { posterId, status: "settled", rewardCents: 5000n });
  const disputeId = newId("dsp");
  await db.insert(disputes).values({ id: disputeId, bountyId, posterId, reason, openedAt: new Date() });
  for (const ownerId of [posterId, winnerOwnerId]) {
    await db.insert(events).values({
      type: "dispute.opened",
      scope: "owner",
      ownerId,
      bountyId,
      data: { bountyId, disputeId, amountCents: 5000 },
    });
  }
  return { disputeId, bountyId };
}

describe("approval emails", () => {
  it("queues one job keyed approval:{id} for a pending_approval spend", async () => {
    const a = await startApp(emailEnv());
    const jobs: EmailJob[] = [];
    setNotifyQueue({ email: async (job) => void jobs.push(job) });
    const { res } = await spend(100);
    expect(res.status).toBe("pending_approval");
    await a.eventBus.pollOnce();
    expect(jobs).toEqual([{ kind: "approval", spendRequestId: res.id }]);
    expect(jobKey(jobs[0]!)).toBe(`approval:${res.id}`);
  });

  it("emails the owner the facts and a link to the approvals page", async () => {
    const a = await startApp(emailEnv());
    const { res, ownerId } = await spend(100, `<script>alert("hi")</script> & more`);
    await a.eventBus.pollOnce();
    await vi.waitFor(() => expect(resend.requests).toHaveLength(1));
    const [req] = resend.requests;
    expect(req?.headers["idempotency-key"]).toBe(`approval:${res.id}`);
    expect(req?.headers.authorization).toBe("Bearer re_test");
    expect(req?.body.to).toEqual([`${ownerId.toLowerCase()}@test.local`]);
    expect(req?.body.subject).toBe("Approval needed: Test agent wants to spend $1.00");
    expect(req?.body.text).toContain('Above your "ask me above" amount');
    expect(req?.body.html).toContain(`${WEB_URL}/approvals`);
    expect(req?.body.html).not.toContain("<script>");
    expect(req?.body.html).toContain("&lt;script&gt;alert(&quot;hi&quot;)&lt;/script&gt; &amp; more");
  });

  it("sends nothing for allowed or denied spends", async () => {
    const a = await startApp(emailEnv());
    const jobs: EmailJob[] = [];
    setNotifyQueue({ email: async (job) => void jobs.push(job) });
    expect((await spend(10)).res.status).toBe("settled");
    expect((await spend(5000)).res.status).toBe("denied");
    await a.eventBus.pollOnce();
    expect(jobs).toEqual([]);
    expect(resend.requests).toHaveLength(0);
  });

  it("sends nothing and doesn't throw when RESEND_API_KEY is unset", async () => {
    const a = await startApp({ RESEND_API_URL: resend.url });
    const spy = vi.spyOn(globalThis, "fetch");
    try {
      await spend(100);
      await a.eventBus.pollOnce();
      // Let the inline job settle.
      await new Promise((r) => setTimeout(r, 50));
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
    expect(resend.requests).toHaveLength(0);
  });

  it("skips a spend that was answered before the job ran", async () => {
    const { res } = await spend(100);
    await db.update(spendRequests).set({ status: "denied" }).where(eq(spendRequests.id, res.id));
    const cfg = notifyConfigFromEnv(emailEnv());
    expect(await runEmailJob(db, cfg, { kind: "approval", spendRequestId: res.id })).toBe(0);
    expect(resend.requests).toHaveLength(0);
  });

  it("throws when Resend fails, and a retry sends with the same key", async () => {
    const { res } = await spend(100);
    const cfg = notifyConfigFromEnv(emailEnv());
    const job: EmailJob = { kind: "approval", spendRequestId: res.id };
    resend.failNext(503);
    await expect(runEmailJob(db, cfg, job)).rejects.toThrow(/503/);
    expect(await runEmailJob(db, cfg, job)).toBe(1);
    expect(resend.requests.map((r) => r.headers["idempotency-key"])).toEqual([
      `approval:${res.id}`,
      `approval:${res.id}`,
    ]);
  });
});

describe("dispute emails", () => {
  it("emails every admin once, with a link to the disputes tab", async () => {
    const a = await startApp(emailEnv());
    const admins = [await makeAdmin(), await makeAdmin()].sort();
    await createUser(db);
    const { disputeId } = await openDispute(`'quoted' & <b>bold</b>`);
    await a.eventBus.pollOnce();
    await vi.waitFor(() => expect(resend.requests).toHaveLength(2));
    // Two dispute.opened events (poster and winner's owner) still make one email per admin.
    await new Promise((r) => setTimeout(r, 50));
    expect(resend.requests).toHaveLength(2);
    expect(resend.requests.map((r) => r.body.to[0]).sort()).toEqual(
      admins.map((id) => `${id.toLowerCase()}@test.local`),
    );
    expect(resend.requests.map((r) => r.headers["idempotency-key"]).sort()).toEqual(
      admins.map((id) => `dispute:${disputeId}:${id}`),
    );
    const [req] = resend.requests;
    expect(req?.body.subject).toBe("Dispute opened: Test extract_data bounty");
    expect(req?.body.text).toContain("Reward: $50.00");
    expect(req?.body.html).toContain(`${WEB_URL}/admin?tab=disputes`);
    expect(req?.body.html).toContain("&#39;quoted&#39; &amp; &lt;b&gt;bold&lt;/b&gt;");
  });

  it("queues one job keyed dispute:{id}", async () => {
    const a = await startApp(emailEnv());
    const jobs: EmailJob[] = [];
    setNotifyQueue({ email: async (job) => void jobs.push(job) });
    const { disputeId } = await openDispute();
    await a.eventBus.pollOnce();
    expect(jobs).toEqual([{ kind: "dispute", disputeId }]);
    expect(jobKey(jobs[0]!)).toBe(`dispute:${disputeId}`);
  });

  it("sends nothing when there are no admins", async () => {
    const { disputeId } = await openDispute();
    expect(await runEmailJob(db, notifyConfigFromEnv(emailEnv()), { kind: "dispute", disputeId })).toBe(0);
    expect(resend.requests).toHaveLength(0);
  });
});
