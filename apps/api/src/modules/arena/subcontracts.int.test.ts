// Subcontracts (sub-01) through the module functions: money, gates, lifecycle, sweep, rating and privacy.
import { REVIEW_WINDOW_MS } from "@gottaeat/schemas";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createAgent,
  createMandate,
  createSpendFixture,
  createTestBounty,
  createTestDb,
  createUserWithWallet,
  resetDb,
  topUp,
} from "../../../test/db";
import { agents, events, ledgerEntries, spendRequests, subcontracts } from "../../db/schema";
import type { AgentPrincipal, Principal } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { clawbackTopup, getBalances, reconcile } from "../ledger";
import { decideApproval, releaseExpired, stubIntentCheck } from "../policy";
import {
  acceptSubcontract,
  cancelSubcontract,
  declineSubcontract,
  deliverSubcontract,
  getSubcontractFor,
  hireAgent,
  listInbox,
  listSubcontractsFor,
  registerArenaHooks,
  rejectSubcontract,
  sweepDeadlines,
  sweepSubcontracts,
} from "./index";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(async () => {
  await resetDb(db);
  registerArenaHooks();
});

const allow = { intentCheck: stubIntentCheck("allow") };
const T0 = new Date(Math.floor(Date.now() / 1000) * 1000);
const minutes = (n: number) => new Date(T0.getTime() + n * 60_000);
const TASK = "Extract the totals from these invoices <b>please</b>";
const DELIVERABLE = '{"total": 1200} <script>alert(1)</script>';

async function fixture(opts?: Parameters<typeof createSpendFixture>[1]) {
  const f = await createSpendFixture(db, { balanceCents: 5000n, ...opts });
  const workerPrincipal: AgentPrincipal = { type: "agent", agentId: f.payeeAgentId, ownerId: f.payeeOwnerId };
  return { ...f, hirer: f.principal, worker: workerPrincipal };
}

type F = Awaited<ReturnType<typeof fixture>>;

async function hire(f: F, over: Partial<Parameters<typeof hireAgent>[2]> = {}, now = T0) {
  return hireAgent(
    db,
    f.hirer,
    { workerAgentId: f.payeeAgentId, task: TASK, amountCents: 500, reason: "Need extraction help", ...over },
    { ...allow, now: () => now },
  );
}

async function hired(f: F, over: Partial<Parameters<typeof hireAgent>[2]> = {}) {
  const res = await hire(f, over);
  if (!res.subcontract) throw new Error(`hire was not created: ${JSON.stringify(res.spend)}`);
  return res.subcontract;
}

async function spendStatus(id: string) {
  const [row] = await db.select({ status: spendRequests.status }).from(spendRequests).where(eq(spendRequests.id, id));
  return row?.status;
}

async function feesCents(): Promise<bigint> {
  const [row] = await db
    .select({ c: sql<string>`coalesce(sum(${ledgerEntries.creditCents} - ${ledgerEntries.debitCents}), 0)::bigint` })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.accountId, "platform:fees"));
  return BigInt(row?.c ?? 0);
}

async function eventTypes() {
  return (await db.select().from(events).orderBy(events.id)).map((e) => e.type);
}

async function expectApiError(p: Promise<unknown>, code: string, status: number) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ApiError);
  expect(err).toMatchObject({ code, status });
}

async function agentRow(id: string) {
  const [row] = await db.select().from(agents).where(eq(agents.id, id));
  if (!row) throw new Error("no agent");
  return row;
}

describe("hire", () => {
  it("holds amount + 2% fee and opens the job", async () => {
    const f = await fixture();
    const res = await hire(f);
    expect(res.spend).toMatchObject({ status: "allowed", decision: "allow" });
    expect(res.subcontract).toMatchObject({
      status: "open",
      amountCents: 500,
      feeCents: 10,
      hirerAgentId: f.agentId,
      workerAgentId: f.payeeAgentId,
      task: TASK,
      deliverable: null,
      spendRequestId: res.spend.id,
      deliverBy: minutes(120).toISOString(),
    });
    expect(res.subcontract?.id).toMatch(/^sub_/);
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 4490n, heldCents: 510n });
    expect(await getBalances(db, f.payeeOwnerId)).toEqual({ balanceCents: 0n, heldCents: 0n });
    expect(await eventTypes()).toContain("subcontract.hired");
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("refuses self-hire and inactive or keyless workers with 422, before any spend", async () => {
    const f = await fixture();
    await expectApiError(hire(f, { workerAgentId: f.agentId }), "validation_error", 422);
    const { agentId: inactive } = await createAgent(db, f.payeeOwnerId, { status: "suspended" });
    await expectApiError(hire(f, { workerAgentId: inactive }), "validation_error", 422);
    const { agentId: revoked } = await createAgent(db, f.payeeOwnerId, { revoked: true });
    await expectApiError(hire(f, { workerAgentId: revoked }), "validation_error", 422);
    await expectApiError(hire(f, { workerAgentId: "agt_nope" }), "validation_error", 422);
    expect(await db.select().from(spendRequests)).toHaveLength(0);
  });

  it("caps deliver-by at the bounty deadline and refuses a bounty with no time left (422 deadline_passed)", async () => {
    const f = await fixture();
    const soon = await createTestBounty(db, { posterId: f.payeeOwnerId, deadlineAt: minutes(30) });
    const sc = await hired(f, { bountyId: soon, amountCents: 400 });
    expect(sc.deliverBy).toBe(minutes(30).toISOString());
    expect(sc.bountyId).toBe(soon);

    const past = await createTestBounty(db, { posterId: f.payeeOwnerId, deadlineAt: minutes(-1) });
    await expectApiError(hire(f, { bountyId: past }), "deadline_passed", 422);
  });
});

describe("gates", () => {
  it("denies a worker rated below minPayeeRating: no job, nothing held", async () => {
    const f = await fixture({ rules: { minPayeeRatingTenths: 40 }, payeeRating: 35 });
    const res = await hire(f);
    expect(res.subcontract).toBeNull();
    expect(res.spend).toMatchObject({ decision: "deny", status: "denied" });
    expect(res.spend.reasons).toContain("payee_rating_too_low");
    expect(await db.select().from(subcontracts)).toHaveLength(0);
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
    expect(await eventTypes()).not.toContain("subcontract.hired");
  });

  it("applies the bounty spend rule to amount + fee", async () => {
    const f = await fixture();
    // 10% of $50 = $5.00: $5.00 + 10¢ fee is over; $4.00 + 8¢ fits.
    const bountyId = await createTestBounty(db, { posterId: f.payeeOwnerId, spendRulePct: 10 });
    const over = await hire(f, { bountyId, amountCents: 500 });
    expect(over.subcontract).toBeNull();
    expect(over.spend.reasons).toContain("over_bounty_spend_rule");
    const ok = await hire(f, { bountyId, amountCents: 400 });
    expect(ok.subcontract?.status).toBe("open");
    // The open hold counts against the rule: another $1 + 2¢ would pass $5.00.
    const again = await hire(f, { bountyId, amountCents: 100 });
    expect(again.spend.reasons).toContain("over_bounty_spend_rule");
  });

  it("denies a frozen hirer", async () => {
    const f = await fixture();
    await db.transaction((tx) =>
      clawbackTopup(tx, {
        topupId: "top_1",
        ownerId: f.ownerId,
        cents: 6000n,
        creditCents: 6000n,
        feeCents: 0n,
        alreadyClawedCents: 0n,
        idempotencyKey: "claw-1",
      }),
    );
    const res = await hire(f);
    expect(res.subcontract).toBeNull();
    expect(res.spend.reasons).toContain("account_frozen");
  });

  it("ask → offered (hidden from the worker); approve → open with a hired event", async () => {
    const f = await fixture({ rules: { askAboveCents: 100 } });
    const res = await hire(f);
    expect(res.spend).toMatchObject({ decision: "pending_approval" });
    expect(res.subcontract?.status).toBe("offered");
    const id = res.subcontract!.id;
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 4490n, heldCents: 510n });
    expect(await eventTypes()).not.toContain("subcontract.hired");
    await expectApiError(getSubcontractFor(db, f.worker, id), "not_found", 404);
    expect(await listInbox(db, f.worker)).toEqual([]);

    const owner = { type: "user" as const, userId: f.ownerId, email: "o@test.local", roles: [] };
    await decideApproval(db, owner, res.spend.id, "approve");
    expect(await spendStatus(res.spend.id)).toBe("allowed");
    expect((await getSubcontractFor(db, f.worker, id)).status).toBe("open");
    expect(await eventTypes()).toContain("subcontract.hired");
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 4490n, heldCents: 510n });
  });

  it("owner deny → cancelled and released", async () => {
    const f = await fixture({ rules: { askAboveCents: 100 } });
    const res = await hire(f);
    const owner = { type: "user" as const, userId: f.ownerId, email: "o@test.local", roles: [] };
    await decideApproval(db, owner, res.spend.id, "deny");
    expect((await getSubcontractFor(db, f.hirer, res.subcontract!.id)).status).toBe("cancelled");
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("approval expiry → cancelled and released", async () => {
    const f = await fixture({ rules: { askAboveCents: 100 } });
    const res = await hire(f);
    expect(await releaseExpired(db, minutes(16))).toBe(1);
    const sc = await getSubcontractFor(db, f.hirer, res.subcontract!.id);
    expect(sc.status).toBe("cancelled");
    expect(sc.decidedAt).toBe(minutes(16).toISOString());
    expect(await spendStatus(res.spend.id)).toBe("released");
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
  });

  it("the hirer can cancel an offered job; a later approval is already decided", async () => {
    const f = await fixture({ rules: { askAboveCents: 100 } });
    const res = await hire(f);
    const sc = await cancelSubcontract(db, f.hirer, res.subcontract!.id);
    expect(sc.status).toBe("cancelled");
    expect(await spendStatus(res.spend.id)).toBe("released");
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
    const owner = { type: "user" as const, userId: f.ownerId, email: "o@test.local", roles: [] };
    await expectApiError(decideApproval(db, owner, res.spend.id, "approve"), "already_decided", 409);
  });
});

describe("lifecycle and money", () => {
  it("deliver → accept pays the worker's owner, the fee to platform:fees, once", async () => {
    const f = await fixture();
    const sc = await hired(f);
    const delivered = await deliverSubcontract(db, f.worker, sc.id, DELIVERABLE, minutes(10));
    expect(delivered).toMatchObject({
      status: "delivered",
      deliverable: DELIVERABLE,
      deliveredAt: minutes(10).toISOString(),
      reviewBy: new Date(minutes(10).getTime() + REVIEW_WINDOW_MS).toISOString(),
    });
    const accepted = await acceptSubcontract(db, f.hirer, sc.id, { rating: 4 }, minutes(20));
    expect(accepted).toMatchObject({ status: "accepted", rating: 4, decidedAt: minutes(20).toISOString() });
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 4490n, heldCents: 0n });
    expect(await getBalances(db, f.payeeOwnerId)).toEqual({ balanceCents: 500n, heldCents: 0n });
    expect(await feesCents()).toBe(10n);
    expect(await spendStatus(sc.spendRequestId)).toBe("settled");
    expect(await reconcile(db)).toMatchObject({ ok: true });

    // A second accept or a reject moves nothing.
    await expectApiError(acceptSubcontract(db, f.hirer, sc.id, {}), "invalid_transition", 409);
    await expectApiError(rejectSubcontract(db, f.hirer, sc.id, "no"), "invalid_transition", 409);
    expect(await getBalances(db, f.payeeOwnerId)).toEqual({ balanceCents: 500n, heldCents: 0n });
    expect(await feesCents()).toBe(10n);
    expect((await eventTypes()).filter((t) => t.startsWith("subcontract."))).toEqual([
      "subcontract.hired",
      "subcontract.delivered",
      "subcontract.accepted",
    ]);
  });

  it("reject releases the hold in full and keeps the reason", async () => {
    const f = await fixture();
    const sc = await hired(f);
    await deliverSubcontract(db, f.worker, sc.id, DELIVERABLE, minutes(5));
    const rejected = await rejectSubcontract(db, f.hirer, sc.id, "Totals are wrong", minutes(6));
    expect(rejected).toMatchObject({ status: "rejected", rejectReason: "Totals are wrong", rating: null });
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
    expect(await getBalances(db, f.payeeOwnerId)).toEqual({ balanceCents: 0n, heldCents: 0n });
    expect(await spendStatus(sc.spendRequestId)).toBe("released");
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("decline (worker) and cancel (hirer) release an open job in full", async () => {
    const f = await fixture();
    const a = await hired(f);
    expect((await declineSubcontract(db, f.worker, a.id)).status).toBe("declined");
    const b = await hired(f);
    expect((await cancelSubcontract(db, f.hirer, b.id)).status).toBe("cancelled");
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
    expect(await spendStatus(a.spendRequestId)).toBe("released");
    expect(await spendStatus(b.spendRequestId)).toBe("released");
    // Ended jobs stay ended.
    await expectApiError(cancelSubcontract(db, f.hirer, a.id), "invalid_transition", 409);
    await expectApiError(deliverSubcontract(db, f.worker, b.id, "late", minutes(1)), "invalid_transition", 409);
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("only the right side may act: 403 for the other side, 404 for strangers", async () => {
    const f = await fixture();
    const sc = await hired(f);
    const strangerOwner = await createUserWithWallet(db);
    const { agentId } = await createAgent(db, strangerOwner);
    const stranger: AgentPrincipal = { type: "agent", agentId, ownerId: strangerOwner };

    await expectApiError(deliverSubcontract(db, f.hirer, sc.id, "x"), "forbidden", 403);
    await expectApiError(deliverSubcontract(db, stranger, sc.id, "x"), "not_found", 404);
    await expectApiError(cancelSubcontract(db, f.worker, sc.id), "forbidden", 403);
    await expectApiError(declineSubcontract(db, f.hirer, sc.id), "forbidden", 403);
    await expectApiError(acceptSubcontract(db, stranger, sc.id, {}), "not_found", 404);
    await expectApiError(acceptSubcontract(db, f.hirer, "sub_missing", {}), "not_found", 404);
    // Accept and reject only once delivered.
    await expectApiError(acceptSubcontract(db, f.hirer, sc.id, {}), "invalid_transition", 409);
    await expectApiError(rejectSubcontract(db, f.hirer, sc.id, "no"), "invalid_transition", 409);
  });

  it("delivering after deliver-by is 409 deadline_passed, and the job expires with its hold released", async () => {
    const f = await fixture();
    const sc = await hired(f, { deliverByMinutes: 30 });
    await expectApiError(deliverSubcontract(db, f.worker, sc.id, "late", minutes(30)), "deadline_passed", 409);
    expect((await getSubcontractFor(db, f.hirer, sc.id)).status).toBe("expired");
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
  });

  it("rejecting after the review window accepts it (rating 5) and answers 409", async () => {
    const f = await fixture();
    const sc = await hired(f);
    await deliverSubcontract(db, f.worker, sc.id, DELIVERABLE, minutes(1));
    await expectApiError(rejectSubcontract(db, f.hirer, sc.id, "too late", minutes(122)), "invalid_transition", 409);
    expect(await getSubcontractFor(db, f.hirer, sc.id)).toMatchObject({ status: "accepted", rating: 5 });
    expect(await getBalances(db, f.payeeOwnerId)).toEqual({ balanceCents: 500n, heldCents: 0n });
  });
});

describe("sweep", () => {
  it("expires open jobs past deliver-by and accepts deliveries past review-by, once", async () => {
    const f = await fixture();
    const late = await hired(f, { deliverByMinutes: 10 });
    const done = await hired(f, { deliverByMinutes: 60 });
    const fresh = await hired(f, { deliverByMinutes: 60 });
    await deliverSubcontract(db, f.worker, done.id, DELIVERABLE, minutes(5));

    const report = (err: unknown) => {
      throw err;
    };
    expect(await sweepSubcontracts(db, minutes(11), report)).toBe(1);
    expect((await getSubcontractFor(db, f.hirer, late.id)).status).toBe("expired");
    expect((await getSubcontractFor(db, f.hirer, done.id)).status).toBe("delivered");

    // Through the arena's deadline sweep: review window (2 h after minute 5) has passed.
    await sweepDeadlines(db, minutes(126));
    expect(await getSubcontractFor(db, f.hirer, done.id)).toMatchObject({ status: "accepted", rating: 5 });
    expect((await getSubcontractFor(db, f.hirer, fresh.id)).status).toBe("expired");

    const before = await getBalances(db, f.payeeOwnerId);
    expect(await sweepSubcontracts(db, minutes(200), report)).toBe(0);
    expect(await getBalances(db, f.payeeOwnerId)).toEqual(before);
    expect(before).toEqual({ balanceCents: 500n, heldCents: 0n });
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 4490n, heldCents: 0n });
    expect(await feesCents()).toBe(10n);
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("keeps going past a broken row and reports it", async () => {
    const f = await fixture();
    const broken = await hired(f, { deliverByMinutes: 10 });
    const ok = await hired(f, { deliverByMinutes: 10 });
    // Break the first: its spend is no longer allowed, so releasing it is an illegal transition.
    await db.update(spendRequests).set({ status: "denied" }).where(eq(spendRequests.id, broken.spendRequestId));
    const failed: string[] = [];
    expect(await sweepSubcontracts(db, minutes(11), (_e, id) => failed.push(id ?? ""))).toBe(1);
    expect(failed).toEqual([broken.id]);
    expect((await getSubcontractFor(db, f.hirer, ok.id)).status).toBe("expired");
    expect((await getSubcontractFor(db, f.hirer, broken.id)).status).toBe("open");
  });
});

describe("rating", () => {
  it("is the mean of accepted ratings from other owners, in tenths; same-owner jobs don't count", async () => {
    const f = await fixture();
    // A second hirer, of a third owner.
    const owner2 = await createUserWithWallet(db);
    await topUp(db, owner2, 5000n);
    const { agentId: hirer2Id } = await createAgent(db, owner2);
    await createMandate(db, { agentId: hirer2Id, createdBy: owner2 });
    const hirer2: AgentPrincipal = { type: "agent", agentId: hirer2Id, ownerId: owner2 };

    const a = await hired(f);
    await deliverSubcontract(db, f.worker, a.id, "a");
    await acceptSubcontract(db, f.hirer, a.id, { rating: 4 });
    expect(await agentRow(f.payeeAgentId)).toMatchObject({ rating: 40, completedJobs: 1 });

    const b = (
      await hireAgent(db, hirer2, { workerAgentId: f.payeeAgentId, task: "b", amountCents: 100, reason: "r" }, allow)
    ).subcontract!;
    await deliverSubcontract(db, f.worker, b.id, "b");
    await acceptSubcontract(db, hirer2, b.id, { rating: 5 });
    expect(await agentRow(f.payeeAgentId)).toMatchObject({ rating: 45, completedJobs: 2 });

    // The worker's own owner hires it: paid, but no rating or completed job.
    await topUp(db, f.payeeOwnerId, 5000n);
    const { agentId: sibling } = await createAgent(db, f.payeeOwnerId);
    await createMandate(db, { agentId: sibling, createdBy: f.payeeOwnerId });
    const self: AgentPrincipal = { type: "agent", agentId: sibling, ownerId: f.payeeOwnerId };
    const c = (
      await hireAgent(db, self, { workerAgentId: f.payeeAgentId, task: "c", amountCents: 100, reason: "r" }, allow)
    ).subcontract!;
    await deliverSubcontract(db, f.worker, c.id, "c");
    await acceptSubcontract(db, self, c.id, { rating: 1 });
    expect(await agentRow(f.payeeAgentId)).toMatchObject({ rating: 45, completedJobs: 2 });

    // 4, 5, 5 → 4.67 → 47 (rounded half up).
    const d = await hired(f, { amountCents: 100 });
    await deliverSubcontract(db, f.worker, d.id, "d");
    await acceptSubcontract(db, f.hirer, d.id, {});
    expect(await agentRow(f.payeeAgentId)).toMatchObject({ rating: 47, completedJobs: 3 });
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });
});

describe("privacy", () => {
  it("events never carry the task or the deliverable", async () => {
    const f = await fixture();
    const sc = await hired(f);
    await deliverSubcontract(db, f.worker, sc.id, DELIVERABLE);
    await acceptSubcontract(db, f.hirer, sc.id, { rating: 4 });
    const rows = await db.select().from(events);
    const sub = rows.filter((r) => r.type.startsWith("subcontract."));
    expect(sub).toHaveLength(3);
    for (const r of sub) expect(r.scope).toBe("public");
    const text = JSON.stringify(rows.map((r) => r.data));
    expect(text).not.toContain("Extract the totals");
    expect(text).not.toContain("alert(1)");
  });

  it("only the two sides (agents and owners) can read a job; strangers get 404", async () => {
    const f = await fixture();
    const sc = await hired(f);
    const strangerOwner = await createUserWithWallet(db);
    const { agentId } = await createAgent(db, strangerOwner);
    const user = (userId: string): Principal => ({ type: "user", userId, email: "u@test.local", roles: [] });

    for (const p of [f.hirer, f.worker, user(f.ownerId), user(f.payeeOwnerId)]) {
      expect((await getSubcontractFor(db, p, sc.id)).task).toBe(TASK);
    }
    await expectApiError(
      getSubcontractFor(db, { type: "agent", agentId, ownerId: strangerOwner }, sc.id),
      "not_found",
      404,
    );
    await expectApiError(getSubcontractFor(db, user(strangerOwner), sc.id), "not_found", 404);
    expect(await listSubcontractsFor(db, user(strangerOwner), {})).toEqual([]);
  });

  it("lists by side: hirer, worker, a user's agent, and the worker's inbox with open and delivered first", async () => {
    const f = await fixture();
    const a = await hired(f);
    await declineSubcontract(db, f.worker, a.id);
    const b = await hired(f);
    const c = await hired(f);
    await deliverSubcontract(db, f.worker, c.id, "c");

    expect((await listSubcontractsFor(db, f.hirer, { role: "hirer" })).map((s) => s.id)).toEqual([c.id, b.id, a.id]);
    expect(await listSubcontractsFor(db, f.hirer, { role: "worker" })).toEqual([]);
    expect((await listSubcontractsFor(db, f.worker, {})).map((s) => s.id)).toEqual([c.id, b.id, a.id]);
    expect((await listInbox(db, f.worker)).map((s) => s.id)).toEqual([c.id, b.id, a.id]);
    const owner: Principal = { type: "user", userId: f.payeeOwnerId, email: "w@test.local", roles: [] };
    expect(await listSubcontractsFor(db, owner, { role: "hirer" })).toEqual([]);
    expect(await listSubcontractsFor(db, owner, { agentId: f.payeeAgentId })).toHaveLength(3);
    await expectApiError(listSubcontractsFor(db, f.hirer, { agentId: f.agentId }), "validation_error", 400);

    // A declined job sinks below open ones in the inbox.
    const d = await hired(f);
    expect((await listInbox(db, f.worker)).map((s) => s.id)).toEqual([d.id, c.id, b.id, a.id]);
    await declineSubcontract(db, f.worker, d.id);
    expect((await listInbox(db, f.worker)).map((s) => s.id)).toEqual([c.id, b.id, d.id, a.id]);
  });
});
