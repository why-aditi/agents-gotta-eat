import { ENTRY_STAKE_CENTS } from "@gottaeat/schemas";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMandate, createSpendFixture, createTestDb, createUserWithWallet, resetDb } from "../../../test/db";
import type { Tx } from "../../db";
import { bounties, entries, escrows, spendRequests } from "../../db/schema";
import type { UserPrincipal } from "../../http/auth";
import { newId } from "../../lib/ids";
import { getBalances, reconcile, stakeAccount } from "../ledger";
import { accountBalance } from "../ledger/wallets";
import {
  createSpendRequest,
  createStakeSpendRequest,
  decideApproval,
  getSpendRequestFor,
  releaseExpired,
  setStakeHooks,
  type SpendDeps,
  stubIntentCheck,
} from "./index";

const { db, pool } = createTestDb();
afterAll(() => pool.end());

const settledHook = vi.fn<(tx: Tx, id: string) => Promise<void>>(async () => {});
const releasedHook = vi.fn<(tx: Tx, id: string) => Promise<void>>(async () => {});

beforeEach(async () => {
  await resetDb(db);
  settledHook.mockClear();
  releasedHook.mockClear();
  setStakeHooks({ onStakeSettled: settledHook, onStakeReleased: releasedHook });
});
afterEach(() => setStakeHooks({ onStakeSettled: async () => {}, onStakeReleased: async () => {} }));

const STAKE = BigInt(ENTRY_STAKE_CENTS);
const allow: SpendDeps = { intentCheck: stubIntentCheck("allow") };
const user = (userId: string): UserPrincipal => ({ type: "user", userId, email: `${userId}@test.local`, roles: [] });

// A bounty row and a dev escrow, written straight to the tables (the arena module owns them in the app).
async function createBounty(
  posterId: string,
  opts?: { status?: "draft" | "open" | "judging"; deadlineAt?: Date; rewardCents?: bigint; spendRulePct?: number },
): Promise<string> {
  const id = newId("bty");
  await db.insert(bounties).values({
    id,
    posterId,
    taskType: "extract_data",
    title: "Test bounty",
    spec: { instructions: "extract" },
    rewardCents: opts?.rewardCents ?? 1000n,
    feeCents: 100n,
    spendRulePct: opts?.spendRulePct ?? 20,
    deadlineAt: opts?.deadlineAt ?? new Date(Date.now() + 3_600_000),
    status: opts?.status ?? "open",
    openedAt: opts?.status === "draft" ? null : new Date(),
  });
  if (opts?.status !== "draft") {
    await db.insert(escrows).values({ bountyId: id, status: "authorized", dev: true, authorizedAt: new Date() });
  }
  return id;
}

// An agent whose mandate allows stakes, with $50.00 in its owner's wallet, and an open bounty by someone else.
async function stakeFixture(opts?: { askAboveCents?: number; categories?: ("stake" | "tool" | "subcontract")[] }) {
  const f = await createSpendFixture(db, {
    balanceCents: 5000n,
    rules: {
      allowedCategories: opts?.categories ?? ["stake", "tool", "subcontract"],
      askAboveCents: opts?.askAboveCents,
    },
  });
  const posterId = await createUserWithWallet(db);
  const bountyId = await createBounty(posterId);
  return { ...f, posterId, bountyId };
}

const stake = (f: Awaited<ReturnType<typeof stakeFixture>>, deps: SpendDeps = allow, bountyId = f.bountyId) =>
  db.transaction((tx) => createStakeSpendRequest(tx, f.principal, { bountyId }, deps));

async function row(id: string) {
  const [r] = await db.select().from(spendRequests).where(eq(spendRequests.id, id));
  if (!r) throw new Error(`no spend request ${id}`);
  return r;
}

describe("createStakeSpendRequest", () => {
  it("allow → settled into stake:{bountyId}, wallet -50, hook called in the transaction", async () => {
    const f = await stakeFixture();
    const res = await stake(f);
    expect(res).toEqual({ id: res.id, status: "settled", decision: "allow", reasons: [] });

    expect(await row(res.id)).toMatchObject({
      category: "stake",
      payeeType: "stake",
      payeeId: null,
      payeeOwnerId: null,
      bountyId: f.bountyId,
      amountCents: STAKE,
      feeCents: 0n,
    });
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n - STAKE, heldCents: 0n });
    expect(await accountBalance(db, stakeAccount(f.bountyId))).toBe(STAKE);
    expect(settledHook).toHaveBeenCalledTimes(1);
    expect(settledHook.mock.calls[0]?.[1]).toBe(res.id);
    expect(releasedHook).not.toHaveBeenCalled();

    const sr = await getSpendRequestFor(db, user(f.ownerId), res.id);
    expect(sr).toMatchObject({ payeeAgentId: null, category: "stake", amountCents: ENTRY_STAKE_CENTS });
    expect(sr.decisions.map((d) => [d.gate, d.verdict])).toEqual([
      ["hard_rules", "allow"],
      ["intent", "allow"],
    ]);
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("rolls back with the caller's transaction", async () => {
    const f = await stakeFixture();
    await expect(
      db.transaction(async (tx) => {
        await createStakeSpendRequest(tx, f.principal, { bountyId: f.bountyId }, allow);
        throw new Error("arena failed");
      }),
    ).rejects.toThrow("arena failed");
    expect(await db.select().from(spendRequests)).toEqual([]);
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("denies category_not_allowed when the mandate has no stake, and holds nothing", async () => {
    const f = await stakeFixture({ categories: ["tool"] });
    const res = await stake(f);
    expect(res).toMatchObject({ status: "denied", decision: "deny", reasons: ["category_not_allowed"] });
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
    expect(settledHook).not.toHaveBeenCalled();
    expect(releasedHook).not.toHaveBeenCalled();
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("denies own_bounty when the agent's owner posted the bounty", async () => {
    const f = await stakeFixture();
    const own = await createBounty(f.ownerId);
    const res = await stake(f, allow, own);
    expect(res).toMatchObject({ status: "denied", reasons: ["own_bounty"] });
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("denies bounty_not_open for a draft, a past deadline, judging, or an unknown bounty", async () => {
    const f = await stakeFixture();
    const draft = await createBounty(f.posterId, { status: "draft" });
    const late = await createBounty(f.posterId, { deadlineAt: new Date(Date.now() - 1000) });
    const judging = await createBounty(f.posterId, { status: "judging" });
    for (const bountyId of [draft, late, judging, "bty_missing"]) {
      const res = await stake(f, allow, bountyId);
      expect(res).toMatchObject({ status: "denied", reasons: ["bounty_not_open"] });
    }
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
    expect(settledHook).not.toHaveBeenCalled();
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("ask → pending_approval with a hold and a 15 minute expiry; approve → stake account, hook", async () => {
    const f = await stakeFixture({ askAboveCents: 0 });
    const res = await stake(f);
    expect(res).toMatchObject({ status: "pending_approval", decision: "pending_approval" });
    expect(res.reasons).toEqual(["above_ask_threshold"]);
    const pending = await row(res.id);
    expect(pending.expiresAt!.getTime() - pending.createdAt.getTime()).toBe(15 * 60_000);
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n - STAKE, heldCents: STAKE });
    expect(settledHook).not.toHaveBeenCalled();

    const sr = await decideApproval(db, user(f.ownerId), res.id, "approve");
    expect(sr.status).toBe("settled");
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n - STAKE, heldCents: 0n });
    expect(await accountBalance(db, stakeAccount(f.bountyId))).toBe(STAKE);
    expect(settledHook).toHaveBeenCalledTimes(1);
    expect(settledHook.mock.calls[0]?.[1]).toBe(res.id);
    expect(releasedHook).not.toHaveBeenCalled();
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("gate 2 ask → pending_approval too", async () => {
    const f = await stakeFixture();
    const res = await stake(f, { intentCheck: stubIntentCheck("ask") });
    expect(res).toMatchObject({ status: "pending_approval", reasons: ["intent_ask"] });
  });

  it("owner deny → released, money back, onStakeReleased", async () => {
    const f = await stakeFixture({ askAboveCents: 0 });
    const res = await stake(f);
    const sr = await decideApproval(db, user(f.ownerId), res.id, "deny");
    expect(sr.status).toBe("released");
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
    expect(await accountBalance(db, stakeAccount(f.bountyId))).toBe(0n);
    expect(releasedHook).toHaveBeenCalledTimes(1);
    expect(releasedHook.mock.calls[0]?.[1]).toBe(res.id);
    expect(settledHook).not.toHaveBeenCalled();
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("approving a stake after its bounty closed releases it instead (409 bounty_closed)", async () => {
    const f = await stakeFixture({ askAboveCents: 0 });
    const res = await stake(f);
    expect(res.status).toBe("pending_approval");
    await db.update(bounties).set({ status: "judging" }).where(eq(bounties.id, f.bountyId));

    await expect(decideApproval(db, user(f.ownerId), res.id, "approve")).rejects.toMatchObject({
      code: "bounty_closed",
    });
    expect((await row(res.id)).status).toBe("released");
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
    expect(await accountBalance(db, stakeAccount(f.bountyId))).toBe(0n);
    expect(releasedHook).toHaveBeenCalledTimes(1);
    expect(settledHook).not.toHaveBeenCalled();
    const sr = await getSpendRequestFor(db, user(f.ownerId), res.id);
    expect(sr.decisions.at(-1)).toMatchObject({ gate: "owner", verdict: "deny", detail: { bountyClosed: true } });
    // A second approve sees the decision already made.
    await expect(decideApproval(db, user(f.ownerId), res.id, "approve")).rejects.toMatchObject({
      code: "already_decided",
    });
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("expiry → released, money back, onStakeReleased", async () => {
    const f = await stakeFixture({ askAboveCents: 0 });
    const created = new Date(Date.now() - 60_000);
    const res = await stake(f, { intentCheck: stubIntentCheck("allow"), now: () => created });
    expect(res.status).toBe("pending_approval");
    expect(await releaseExpired(db, new Date(created.getTime() + 15 * 60_000))).toBe(1);
    expect((await row(res.id)).status).toBe("released");
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
    expect(releasedHook).toHaveBeenCalledTimes(1);
    expect(releasedHook.mock.calls[0]?.[1]).toBe(res.id);
    expect(settledHook).not.toHaveBeenCalled();
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("does not call stake hooks for ordinary spends", async () => {
    const f = await createSpendFixture(db, { balanceCents: 5000n });
    const spend = await createSpendRequest(
      db,
      f.principal,
      { payeeAgentId: f.payeeAgentId, amountCents: 100, category: "subcontract", reason: "x" },
      { intentCheck: stubIntentCheck("ask") },
    );
    await decideApproval(db, user(f.ownerId), spend.id, "deny");
    expect(settledHook).not.toHaveBeenCalled();
    expect(releasedHook).not.toHaveBeenCalled();
  });
});

describe("createSpendRequest naming a bounty", () => {
  const tool = (f: Awaited<ReturnType<typeof stakeFixture>>, amountCents: number) =>
    createSpendRequest(
      db,
      f.principal,
      { payeeAgentId: f.payeeAgentId, amountCents, category: "tool", reason: "for the bounty", bountyId: f.bountyId },
      allow,
    );

  it("respects the bounty spend rule (20% of $10.00), not counting stakes", async () => {
    const f = await stakeFixture();
    expect((await stake(f)).status).toBe("settled");
    expect((await tool(f, 150)).status).toBe("settled");
    expect(await tool(f, 51)).toMatchObject({ status: "denied", reasons: ["over_bounty_spend_rule"] });
    expect((await tool(f, 50)).status).toBe("settled");
    expect(await tool(f, 1)).toMatchObject({ status: "denied", reasons: ["over_bounty_spend_rule"] });
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n - STAKE - 200n, heldCents: 0n });
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("denies bounty_not_open for a closed bounty", async () => {
    const f = await stakeFixture();
    await db.update(bounties).set({ status: "judging" }).where(eq(bounties.id, f.bountyId));
    expect(await tool(f, 10)).toMatchObject({ status: "denied", reasons: ["bounty_not_open"] });
  });

  it("current_bounty_only needs an active or submitted entry", async () => {
    const f = await stakeFixture();
    await createMandate(db, {
      agentId: f.agentId,
      createdBy: f.ownerId,
      version: 2,
      rules: { allowedCategories: ["tool"], scope: "current_bounty_only" },
    });
    expect(await tool(f, 10)).toMatchObject({ status: "denied", reasons: ["scope_requires_entry"] });

    const entryId = newId("ent");
    await db.insert(entries).values({
      id: entryId,
      bountyId: f.bountyId,
      agentId: f.agentId,
      ownerId: f.ownerId,
      status: "pending_stake",
    });
    expect(await tool(f, 10)).toMatchObject({ status: "denied", reasons: ["scope_requires_entry"] });

    await db.update(entries).set({ status: "active" }).where(eq(entries.id, entryId));
    expect((await tool(f, 10)).status).toBe("settled");
    await db.update(entries).set({ status: "submitted" }).where(eq(entries.id, entryId));
    expect((await tool(f, 10)).status).toBe("settled");
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });
});
