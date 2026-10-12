import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAgent,
  createMandate,
  createSpendFixture,
  createTestDb,
  createUserWithWallet,
  resetDb,
  topUp,
} from "../../../test/db";
import { mandates, spendRequests } from "../../db/schema";
import type { UserPrincipal } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { getBalances, reconcile } from "../ledger";
import {
  confirmMandate,
  createSpendRequest,
  decideApproval,
  getActiveMandate,
  getSpendRequestFor,
  listMandates,
  putMandate,
  stubIntentCheck,
  todaySpentCents,
  type IntentCheck,
} from "./index";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(() => resetDb(db));

const allow = { intentCheck: stubIntentCheck("allow") };
const body = (over?: object) => ({ amountCents: 100, category: "tool" as const, reason: "API credits", ...over });

async function decisions(id: string) {
  const sr = await loadAs(id);
  return sr.decisions.map((d) => [d.gate, d.verdict]);
}

async function loadAs(id: string) {
  const [row] = await db.select().from(spendRequests).where(eq(spendRequests.id, id));
  if (!row) throw new Error("missing");
  return getSpendRequestFor(db, { type: "user", userId: row.ownerId, email: "x@test.local", roles: [] }, id);
}

describe("createSpendRequest outcomes", () => {
  it("settles an allowed tool spend at once with no fee", async () => {
    const f = await createSpendFixture(db, { balanceCents: 5000n });
    const res = await createSpendRequest(db, f.principal, { ...body(), payeeAgentId: f.payeeAgentId }, allow);
    expect(res).toMatchObject({ status: "settled", decision: "allow", reasons: [] });
    expect(res.id).toMatch(/^spr_/);
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 4900n, heldCents: 0n });
    expect(await getBalances(db, f.payeeOwnerId)).toEqual({ balanceCents: 100n, heldCents: 0n });
    expect(await decisions(res.id)).toEqual([
      ["hard_rules", "allow"],
      ["intent", "allow"],
    ]);
    const sr = await loadAs(res.id);
    expect(sr).toMatchObject({ amountCents: 100, feeCents: 0, payeeAgentId: f.payeeAgentId, expiresAt: null });
    expect(sr.decidedAt).not.toBeNull();
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("holds amount + 2% fee for an allowed subcontract and leaves it allowed", async () => {
    const f = await createSpendFixture(db, { balanceCents: 5000n });
    const res = await createSpendRequest(
      db,
      f.principal,
      { ...body({ category: "subcontract", amountCents: 825 }), payeeAgentId: f.payeeAgentId },
      allow,
    );
    expect(res).toMatchObject({ status: "allowed", decision: "allow" });
    // 2% of 825 = 16.5 → 17 (half-up).
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n - 842n, heldCents: 842n });
    expect(await getBalances(db, f.payeeOwnerId)).toEqual({ balanceCents: 0n, heldCents: 0n });
    expect((await loadAs(res.id)).feeCents).toBe(17);
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("asks above askAboveCents: holds, pending_approval, expires in 15 minutes", async () => {
    const f = await createSpendFixture(db, { balanceCents: 5000n, rules: { askAboveCents: 99 } });
    const now = new Date();
    const res = await createSpendRequest(
      db,
      f.principal,
      { ...body(), payeeAgentId: f.payeeAgentId },
      { ...allow, now: () => now },
    );
    expect(res).toEqual({
      id: res.id,
      status: "pending_approval",
      decision: "pending_approval",
      reasons: ["above_ask_threshold"],
    });
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 4900n, heldCents: 100n });
    const sr = await loadAs(res.id);
    expect(sr.expiresAt).toBe(new Date(now.getTime() + 15 * 60_000).toISOString());
    expect(sr.decidedAt).toBeNull();
    expect(await decisions(res.id)).toEqual([
      ["hard_rules", "ask"],
      ["intent", "allow"],
    ]);
  });

  it("gate 2 can tighten allow to ask", async () => {
    const f = await createSpendFixture(db, { balanceCents: 5000n });
    const res = await createSpendRequest(
      db,
      f.principal,
      { ...body(), payeeAgentId: f.payeeAgentId },
      {
        intentCheck: stubIntentCheck("ask"),
      },
    );
    expect(res).toMatchObject({ status: "pending_approval", decision: "pending_approval", reasons: ["intent_ask"] });
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 4900n, heldCents: 100n });
  });

  it("gate 2 deny holds nothing and keeps its confidence and reason", async () => {
    const f = await createSpendFixture(db, { balanceCents: 5000n });
    const intentCheck: IntentCheck = async () => ({ verdict: "deny", confidence: 91, reason: "unrelated to task" });
    const res = await createSpendRequest(db, f.principal, { ...body(), payeeAgentId: f.payeeAgentId }, { intentCheck });
    expect(res).toMatchObject({ status: "denied", decision: "deny", reasons: ["intent_deny"] });
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
    const sr = await loadAs(res.id);
    expect(sr.decisions[1]).toMatchObject({
      gate: "intent",
      verdict: "deny",
      confidence: 91,
      detail: { reason: "unrelated to task" },
    });
  });

  it("a gate 1 deny holds nothing and never calls gate 2", async () => {
    const f = await createSpendFixture(db, { balanceCents: 5000n });
    const intentCheck = vi.fn(stubIntentCheck("allow"));
    const res = await createSpendRequest(
      db,
      f.principal,
      { ...body({ amountCents: 1001 }), payeeAgentId: f.payeeAgentId },
      { intentCheck },
    );
    expect(res).toMatchObject({ status: "denied", decision: "deny", reasons: ["over_per_tx"] });
    expect(intentCheck).not.toHaveBeenCalled();
    expect(await decisions(res.id)).toEqual([["hard_rules", "deny"]]);
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
  });

  it("denies when the balance can't cover amount + fee", async () => {
    const f = await createSpendFixture(db, { balanceCents: 100n });
    const res = await createSpendRequest(
      db,
      f.principal,
      { ...body({ category: "subcontract" }), payeeAgentId: f.payeeAgentId },
      allow,
    );
    expect(res.reasons).toEqual(["insufficient_funds"]);
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 100n, heldCents: 0n });
  });

  it("rejects stakes with validation_error", async () => {
    const f = await createSpendFixture(db, { balanceCents: 5000n });
    const input = { ...body({ category: "stake" }), payeeAgentId: f.payeeAgentId } as never;
    await expect(createSpendRequest(db, f.principal, input, allow)).rejects.toMatchObject({
      code: "validation_error",
    });
  });
});

describe("gate 1 inputs", () => {
  it("denies the 11th request in 60 s", async () => {
    const f = await createSpendFixture(db, { balanceCents: 5000n });
    for (let i = 0; i < 10; i++) {
      const r = await createSpendRequest(
        db,
        f.principal,
        { ...body({ amountCents: 1 }), payeeAgentId: f.payeeAgentId },
        allow,
      );
      expect(r.status).toBe("settled");
    }
    const r = await createSpendRequest(
      db,
      f.principal,
      { ...body({ amountCents: 1 }), payeeAgentId: f.payeeAgentId },
      allow,
    );
    expect(r).toMatchObject({ status: "denied", reasons: ["rate_limited"] });
    // A minute later the window is clear.
    const later = new Date(Date.now() + 61_000);
    const ok = await createSpendRequest(
      db,
      f.principal,
      { ...body({ amountCents: 1 }), payeeAgentId: f.payeeAgentId },
      { ...allow, now: () => later },
    );
    expect(ok.status).toBe("settled");
  });

  it("denies with no_mandate, and ignores unconfirmed versions", async () => {
    const ownerId = await createUserWithWallet(db);
    const payeeOwner = await createUserWithWallet(db);
    const { agentId } = await createAgent(db, ownerId);
    const { agentId: payeeAgentId } = await createAgent(db, payeeOwner);
    const principal = { type: "agent" as const, agentId, ownerId };
    await topUp(db, ownerId, 5000n);

    expect(await createSpendRequest(db, principal, { ...body(), payeeAgentId }, allow)).toMatchObject({
      status: "denied",
      reasons: ["no_mandate"],
    });

    await createMandate(db, { agentId, createdBy: ownerId, version: 1, confirmed: false });
    expect((await createSpendRequest(db, principal, { ...body(), payeeAgentId }, allow)).reasons).toEqual([
      "no_mandate",
    ]);

    // v1 confirmed allows 1000 per tx; an unconfirmed v2 with a 10-cent cap is ignored.
    await db.update(mandates).set({ confirmedAt: new Date() });
    await createMandate(db, {
      agentId,
      createdBy: ownerId,
      version: 2,
      confirmed: false,
      rules: { perTxMaxCents: 10 },
    });
    expect((await createSpendRequest(db, principal, { ...body(), payeeAgentId }, allow)).status).toBe("settled");
  });

  it("denies an unknown payee and records no payee", async () => {
    const f = await createSpendFixture(db, { balanceCents: 5000n });
    const res = await createSpendRequest(db, f.principal, { ...body(), payeeAgentId: "agt_nobody" }, allow);
    expect(res).toMatchObject({ status: "denied", reasons: ["unknown_payee"] });
    expect((await loadAs(res.id)).payeeAgentId).toBeNull();
  });

  it("denies paying yourself but allows another agent of the same owner", async () => {
    const f = await createSpendFixture(db, { balanceCents: 5000n });
    const self = await createSpendRequest(db, f.principal, { ...body(), payeeAgentId: f.agentId }, allow);
    expect(self.reasons).toEqual(["self_payee"]);
    const { agentId: sibling } = await createAgent(db, f.ownerId);
    const res = await createSpendRequest(db, f.principal, { ...body(), payeeAgentId: sibling }, allow);
    expect(res.status).toBe("settled");
    // Money moved from the owner to the owner.
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("denies a payee below the minimum rating", async () => {
    const f = await createSpendFixture(db, {
      balanceCents: 5000n,
      payeeRating: 39,
      rules: { minPayeeRatingTenths: 40 },
    });
    const res = await createSpendRequest(db, f.principal, { ...body(), payeeAgentId: f.payeeAgentId }, allow);
    expect(res.reasons).toEqual(["payee_rating_too_low"]);
  });

  it("daily total counts pending, allowed and settled, not denied or released", async () => {
    const f = await createSpendFixture(db, { balanceCents: 5000n, rules: { dailyMaxCents: 300, askAboveCents: 120 } });
    const owner: UserPrincipal = { type: "user", userId: f.ownerId, email: "o@test.local", roles: [] };
    const spend = (amountCents: number) =>
      createSpendRequest(db, f.principal, { ...body({ amountCents }), payeeAgentId: f.payeeAgentId }, allow);

    expect((await spend(100)).status).toBe("settled");
    const asked = await spend(150);
    expect(asked.status).toBe("pending_approval");
    expect(await todaySpentCents(db, f.agentId, new Date())).toBe(250n);
    await decideApproval(db, owner, asked.id, "deny");
    expect((await spend(5000)).status).toBe("denied");
    expect(await todaySpentCents(db, f.agentId, new Date())).toBe(100n);

    expect((await spend(101)).status).toBe("settled");
    // 201 spent; 100 more would be 301.
    expect(await spend(100)).toMatchObject({ status: "denied", reasons: ["over_daily"] });
    expect((await spend(99)).status).toBe("settled");
  });

  it("daily total resets at 00:00 UTC", async () => {
    const f = await createSpendFixture(db, { balanceCents: 5000n, rules: { dailyMaxCents: 100 } });
    const spendAt = (iso: string) =>
      createSpendRequest(
        db,
        f.principal,
        { ...body(), payeeAgentId: f.payeeAgentId },
        { ...allow, now: () => new Date(iso) },
      );
    expect((await spendAt("2026-10-11T23:58:00.000Z")).status).toBe("settled");
    expect((await spendAt("2026-10-11T23:59:30.000Z")).reasons).toEqual(["over_daily"]);
    expect((await spendAt("2026-10-12T00:00:00.000Z")).status).toBe("settled");
  });
});

describe("mandates", () => {
  it("PUT adds versions; confirm activates; highest confirmed wins", async () => {
    const f = await createSpendFixture(db, {});
    // The fixture inserted v1 (confirmed).
    const v2 = await putMandate(db, f.ownerId, f.agentId, {
      sourceText: "Up to $5 per spend",
      rules: {
        perTxMaxCents: 500,
        dailyMaxCents: 2000,
        allowedCategories: ["tool"],
        payeeAllowlist: null,
        scope: "any",
      },
    });
    expect(v2).toMatchObject({ version: 2, confirmedAt: null, agentId: f.agentId });
    expect((await getActiveMandate(db, f.agentId))?.version).toBe(1);

    const v3 = await putMandate(db, f.ownerId, f.agentId, { sourceText: "v3", rules: v2.rules });
    expect(v3.version).toBe(3);
    await confirmMandate(db, f.ownerId, f.agentId, 3);
    expect((await getActiveMandate(db, f.agentId))?.version).toBe(3);
    // Confirming an older version doesn't override a higher confirmed one.
    const confirmed2 = await confirmMandate(db, f.ownerId, f.agentId, 2);
    expect(confirmed2.confirmedAt).not.toBeNull();
    expect((await getActiveMandate(db, f.agentId))?.version).toBe(3);
    // Re-confirming keeps the first timestamp.
    expect((await confirmMandate(db, f.ownerId, f.agentId, 2)).confirmedAt).toBe(confirmed2.confirmedAt);

    expect((await listMandates(db, f.ownerId, f.agentId)).map((m) => m.version)).toEqual([3, 2, 1]);
  });

  it("404s for another owner's agent and an unknown version", async () => {
    const f = await createSpendFixture(db, {});
    const rules = {
      perTxMaxCents: 1,
      dailyMaxCents: 1,
      allowedCategories: ["tool" as const],
      payeeAllowlist: null,
      scope: "any" as const,
    };
    await expect(putMandate(db, f.payeeOwnerId, f.agentId, { sourceText: "x", rules })).rejects.toBeInstanceOf(
      ApiError,
    );
    await expect(putMandate(db, f.payeeOwnerId, f.agentId, { sourceText: "x", rules })).rejects.toMatchObject({
      status: 404,
    });
    await expect(confirmMandate(db, f.ownerId, f.agentId, 99)).rejects.toMatchObject({ code: "not_found" });
    await expect(listMandates(db, f.payeeOwnerId, f.agentId)).rejects.toMatchObject({ code: "not_found" });
  });

  it("an expired mandate denies", async () => {
    const f = await createSpendFixture(db, { balanceCents: 5000n, rules: { expiresAt: "2026-01-01T00:00:00.000Z" } });
    const res = await createSpendRequest(db, f.principal, { ...body(), payeeAgentId: f.payeeAgentId }, allow);
    expect(res.reasons).toEqual(["mandate_expired"]);
  });
});
