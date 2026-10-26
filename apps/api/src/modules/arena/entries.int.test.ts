import { ENTRY_STAKE_CENTS, type MandateRules } from "@gottaeat/schemas";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createAgent,
  createSpendFixture,
  createTestBounty,
  createTestDb,
  createUserWithWallet,
  resetDb,
} from "../../../test/db";
import { entries, spendRequests } from "../../db/schema";
import type { Principal, UserPrincipal } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { getBalances, reconcile, stakeAccount } from "../ledger";
import { accountBalance } from "../ledger/wallets";
import { decideApproval, releaseExpired, type SpendDeps, stubIntentCheck } from "../policy";
import { enterBounty, getEntryFor, registerArenaHooks } from "./index";

const { db, pool } = createTestDb({ max: 10 });
afterAll(() => pool.end());
beforeEach(async () => {
  await resetDb(db);
  registerArenaHooks();
});

const STAKE = BigInt(ENTRY_STAKE_CENTS);
const allow: SpendDeps = { intentCheck: stubIntentCheck("allow") };
const user = (userId: string): UserPrincipal => ({ type: "user", userId, email: `${userId}@test.local`, roles: [] });

// An agent allowed to stake, $50.00 in its owner's wallet, and an open bounty posted by someone else.
async function fixture(opts?: { rules?: Partial<MandateRules>; status?: "draft" | "open" | "judging" }) {
  const f = await createSpendFixture(db, {
    balanceCents: 5000n,
    rules: { allowedCategories: ["stake", "tool", "subcontract"], ...opts?.rules },
  });
  const posterId = await createUserWithWallet(db);
  const bountyId = await createTestBounty(db, { posterId, status: opts?.status });
  return { ...f, posterId, bountyId };
}

async function entryRows(bountyId: string) {
  return db.select().from(entries).where(eq(entries.bountyId, bountyId));
}

async function stakeRequests(agentId: string) {
  return db.select().from(spendRequests).where(eq(spendRequests.agentId, agentId));
}

describe("enterBounty", () => {
  it("allow → active entry, the stake moves from the wallet to stake:{bountyId}", async () => {
    const f = await fixture();
    const { existing, response } = await enterBounty(db, f.principal, f.bountyId, allow);
    expect(existing).toBe(false);
    expect(response.stake).toMatchObject({ decision: "allow", reasons: [] });
    expect(response.entry).toMatchObject({
      bountyId: f.bountyId,
      agentId: f.agentId,
      status: "active",
      stakeSpendRequestId: response.stake.spendRequestId,
      submissionId: null,
    });
    expect(response.entry?.id).toMatch(/^ent_/);
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n - STAKE, heldCents: 0n });
    expect(await accountBalance(db, stakeAccount(f.bountyId))).toBe(STAKE);
    const [sr] = await stakeRequests(f.agentId);
    expect(sr).toMatchObject({ category: "stake", payeeType: "stake", bountyId: f.bountyId, status: "settled" });
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("ask → pending_stake; the owner approves → active", async () => {
    const f = await fixture({ rules: { askAboveCents: 0 } });
    const { response } = await enterBounty(db, f.principal, f.bountyId, allow);
    expect(response.stake).toMatchObject({ decision: "pending_approval", reasons: ["above_ask_threshold"] });
    expect(response.entry?.status).toBe("pending_stake");
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n - STAKE, heldCents: STAKE });

    await decideApproval(db, user(f.ownerId), response.stake.spendRequestId, "approve");
    const [row] = await entryRows(f.bountyId);
    expect(row?.status).toBe("active");
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n - STAKE, heldCents: 0n });
    expect(await accountBalance(db, stakeAccount(f.bountyId))).toBe(STAKE);
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("gate 2 ask → pending_stake with intent_ask", async () => {
    const f = await fixture();
    const { response } = await enterBounty(db, f.principal, f.bountyId, { intentCheck: stubIntentCheck("ask") });
    expect(response.stake).toMatchObject({ decision: "pending_approval", reasons: ["intent_ask"] });
    expect(response.entry?.status).toBe("pending_stake");
  });

  it("ask → the owner denies → withdrawn, the stake goes back", async () => {
    const f = await fixture({ rules: { askAboveCents: 0 } });
    const { response } = await enterBounty(db, f.principal, f.bountyId, allow);
    await decideApproval(db, user(f.ownerId), response.stake.spendRequestId, "deny");
    const [row] = await entryRows(f.bountyId);
    expect(row?.status).toBe("withdrawn");
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
    expect(await accountBalance(db, stakeAccount(f.bountyId))).toBe(0n);
    expect(await reconcile(db)).toMatchObject({ ok: true });

    // Entering again returns the withdrawn entry; no new stake.
    const again = await enterBounty(db, f.principal, f.bountyId, allow);
    expect(again.existing).toBe(true);
    expect(again.response.entry?.status).toBe("withdrawn");
    expect(again.response.stake).toMatchObject({ spendRequestId: response.stake.spendRequestId, decision: "deny" });
    expect(await stakeRequests(f.agentId)).toHaveLength(1);
  });

  it("ask → the approval expires → withdrawn", async () => {
    const f = await fixture({ rules: { askAboveCents: 0 } });
    await enterBounty(db, f.principal, f.bountyId, allow);
    expect(await releaseExpired(db, new Date(Date.now() + 16 * 60_000))).toBe(1);
    const [row] = await entryRows(f.bountyId);
    expect(row?.status).toBe("withdrawn");
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("no mandate → no entry, deny with reasons", async () => {
    const ownerId = await createUserWithWallet(db);
    const { agentId } = await createAgent(db, ownerId);
    const posterId = await createUserWithWallet(db);
    const bountyId = await createTestBounty(db, { posterId });
    const { existing, response } = await enterBounty(db, { type: "agent", agentId, ownerId }, bountyId, allow);
    expect(existing).toBe(false);
    expect(response.entry).toBeNull();
    expect(response.stake.decision).toBe("deny");
    expect(response.stake.reasons).toContain("no_mandate");
    expect(await entryRows(bountyId)).toHaveLength(0);

    // A denied stake leaves no entry, so trying again asks policy again.
    const again = await enterBounty(db, { type: "agent", agentId, ownerId }, bountyId, allow);
    expect(again.response.entry).toBeNull();
    expect(again.response.stake.spendRequestId).not.toBe(response.stake.spendRequestId);
  });

  it("stake not in the mandate's categories → deny", async () => {
    const f = await fixture({ rules: { allowedCategories: ["tool"] } });
    const { response } = await enterBounty(db, f.principal, f.bountyId, allow);
    expect(response.entry).toBeNull();
    expect(response.stake.reasons).toContain("category_not_allowed");
  });

  it("an agent can't enter its owner's own bounty", async () => {
    const f = await fixture();
    const own = await createTestBounty(db, { posterId: f.ownerId });
    const { response } = await enterBounty(db, f.principal, own, allow);
    expect(response.entry).toBeNull();
    expect(response.stake).toMatchObject({ decision: "deny", reasons: ["own_bounty"] });
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
  });

  it.each(["draft", "judging"] as const)("a %s bounty → deny bounty_not_open", async (status) => {
    const f = await fixture({ status });
    const { response } = await enterBounty(db, f.principal, f.bountyId, allow);
    expect(response.entry).toBeNull();
    expect(response.stake.reasons).toContain("bounty_not_open");
  });

  it("an open bounty past its deadline → deny bounty_not_open", async () => {
    const f = await fixture();
    const late = await createTestBounty(db, { posterId: f.posterId, deadlineAt: new Date(Date.now() - 1000) });
    const { response } = await enterBounty(db, f.principal, late, allow);
    expect(response.entry).toBeNull();
    expect(response.stake.reasons).toContain("bounty_not_open");
  });

  it("an unknown bounty → 404", async () => {
    const f = await fixture();
    const err = await enterBounty(db, f.principal, "bty_missing", allow).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("not_found");
  });

  it("entering twice returns the same entry and makes one stake", async () => {
    const f = await fixture();
    const first = await enterBounty(db, f.principal, f.bountyId, allow);
    const second = await enterBounty(db, f.principal, f.bountyId, allow);
    expect(second.existing).toBe(true);
    expect(second.response).toEqual(first.response);
    expect(await stakeRequests(f.agentId)).toHaveLength(1);
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n - STAKE, heldCents: 0n });
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("concurrent enters by one agent make one entry and one stake", async () => {
    const f = await fixture();
    const results = await Promise.all(Array.from({ length: 5 }, () => enterBounty(db, f.principal, f.bountyId, allow)));
    expect(results.filter((r) => !r.existing)).toHaveLength(1);
    expect(new Set(results.map((r) => r.response.entry?.id)).size).toBe(1);
    expect(await entryRows(f.bountyId)).toHaveLength(1);
    expect(await stakeRequests(f.agentId)).toHaveLength(1);
    expect(await accountBalance(db, stakeAccount(f.bountyId))).toBe(STAKE);
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("two agents of different owners both enter", async () => {
    const f = await fixture();
    const g = await createSpendFixture(db, {
      balanceCents: 1000n,
      rules: { allowedCategories: ["stake"] },
    });
    await enterBounty(db, f.principal, f.bountyId, allow);
    await enterBounty(db, g.principal, f.bountyId, allow);
    expect(await entryRows(f.bountyId)).toHaveLength(2);
    expect(await accountBalance(db, stakeAccount(f.bountyId))).toBe(2n * STAKE);
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });
});

describe("getEntryFor", () => {
  it("agent: own entries; user: own agents' entries or entries on own bounties; else 404", async () => {
    const f = await fixture();
    const { response } = await enterBounty(db, f.principal, f.bountyId, allow);
    const entryId = response.entry!.id;
    const strangerId = await createUserWithWallet(db);
    const { agentId: otherAgent } = await createAgent(db, f.ownerId);
    const { agentId: strangerAgent } = await createAgent(db, strangerId);

    const visible: Principal[] = [f.principal, user(f.ownerId), user(f.posterId)];
    for (const p of visible) expect((await getEntryFor(db, p, entryId)).id).toBe(entryId);

    const hidden: Principal[] = [
      user(strangerId),
      { type: "agent", agentId: otherAgent, ownerId: f.ownerId },
      { type: "agent", agentId: strangerAgent, ownerId: strangerId },
    ];
    for (const p of hidden) {
      const err = await getEntryFor(db, p, entryId).catch((e: unknown) => e);
      expect((err as ApiError).code).toBe("not_found");
    }
    const missing = await getEntryFor(db, f.principal, "ent_missing").catch((e: unknown) => e);
    expect((missing as ApiError).code).toBe("not_found");
  });
});
