import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  at,
  bountyRow,
  dataMatching,
  enter,
  type Entrant,
  entryRow,
  escrowStatus,
  openBounty,
  submit,
} from "../../../test/arena";
import { createTestBounty, createTestDb, createUserWithWallet, resetDb } from "../../../test/db";
import { bounties, escrows, journals, judgements } from "../../db/schema";
import { getJudgementsForBounty } from "../judge";
import { getBalances, PLATFORM_FEES, reconcile, stakeAccount } from "../ledger";
import { accountBalance } from "../ledger/wallets";
import { getResultsFor, judgeBounty, PICK_WINDOW_MS, registerArenaHooks, sweepDeadlines } from "./index";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(async () => {
  await resetDb(db);
  registerArenaHooks();
});

const AFTER = at(61);
const balance = async (e: Entrant) => (await getBalances(db, e.ownerId)).balanceCents;
const anyone = { type: "user" as const, userId: "usr_anyone", email: "anyone@test.local", roles: [] };

describe("judgeBounty (extract_data)", () => {
  it("pays the best passing score, refunds passers, forfeits the rest", async () => {
    const { bountyId } = await openBounty(db);
    const top = await enter(db, bountyId);
    const mid = await enter(db, bountyId);
    const low = await enter(db, bountyId);
    const idle = await enter(db, bountyId);
    const pending = await enter(db, bountyId, { askAboveCents: 0 });
    expect((await entryRow(db, pending.entryId)).status).toBe("pending_stake");
    await submit(db, low, { data: dataMatching(2) }, 1);
    await submit(db, mid, { data: dataMatching(3) }, 2);
    await submit(db, top, { data: dataMatching(5) }, 3);
    expect(await accountBalance(db, stakeAccount(bountyId))).toBe(200n);
    const feesBefore = await accountBalance(db, PLATFORM_FEES);

    // The sweep moves the bounty to judging and judges it.
    expect(await sweepDeadlines(db, AFTER)).toBe(1);

    const bounty = await bountyRow(db, bountyId);
    expect(bounty).toMatchObject({ status: "settled", winnerEntryId: top.entryId });
    expect(bounty.judgingStartedAt).toEqual(AFTER);
    expect(bounty.settledAt).toEqual(AFTER);
    expect(await escrowStatus(db, bountyId)).toBe("captured");

    const scores = await getJudgementsForBounty(db, bountyId);
    expect(new Map(scores.map((j) => [j.entryId, j.score]))).toEqual(
      new Map([
        [top.entryId, 100],
        [mid.entryId, 60],
        [low.entryId, 40],
      ]),
    );
    expect(scores.every((j) => j.verifier === "extract_data_v1")).toBe(true);
    // The answer key never reaches a judgement.
    for (const j of scores) expect(JSON.stringify(j.rawOutput)).not.toMatch(/Acme|answerKey/);

    // Reward to the winner's dispute hold (disp-01: held for 12 hours); 100 and 60 refunded; 40 and the
    // non-submitter forfeit.
    expect(await getBalances(db, top.ownerId)).toEqual({ balanceCents: 5000n - 50n + 50n, heldCents: 5000n });
    expect(bounty.disputeUntil).toEqual(new Date(AFTER.getTime() + 12 * 3_600_000));
    expect(await balance(mid)).toBe(5000n);
    expect(await balance(low)).toBe(4950n);
    expect(await balance(idle)).toBe(4950n);
    expect(await getBalances(db, pending.ownerId)).toEqual({ balanceCents: 4950n, heldCents: 50n });
    expect(await accountBalance(db, PLATFORM_FEES)).toBe(feesBefore + 500n + 100n);
    expect(await accountBalance(db, stakeAccount(bountyId))).toBe(0n);

    expect((await entryRow(db, top.entryId)).stakeOutcome).toBe("refunded");
    expect((await entryRow(db, mid.entryId)).stakeOutcome).toBe("refunded");
    expect((await entryRow(db, low.entryId)).stakeOutcome).toBe("forfeited");
    expect((await entryRow(db, idle.entryId)).stakeOutcome).toBe("forfeited");
    expect((await entryRow(db, pending.entryId)).stakeOutcome).toBeNull();

    const results = await getResultsFor(db, anyone, bountyId);
    expect(results).toMatchObject({ bountyId, status: "settled", winnerEntryId: top.entryId });
    const byEntry = new Map(results.entries.map((e) => [e.entryId, e]));
    expect(byEntry.get(top.entryId)).toMatchObject({ score: 100, passed: true, stakeOutcome: "refunded" });
    expect(byEntry.get(mid.entryId)).toMatchObject({ score: 60, passed: true, stakeOutcome: "refunded" });
    expect(byEntry.get(low.entryId)).toMatchObject({ score: 40, passed: false, stakeOutcome: "forfeited" });
    expect(byEntry.get(idle.entryId)).toMatchObject({ score: null, passed: false, stakeOutcome: "forfeited" });
    expect(byEntry.get(pending.entryId)).toMatchObject({ status: "pending_stake", score: null, stakeOutcome: null });
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("ties go to the earliest submission, then the lowest submission id", async () => {
    const { bountyId } = await openBounty(db);
    const late = await enter(db, bountyId);
    const early = await enter(db, bountyId);
    await submit(db, late, { data: dataMatching(4) }, 5);
    await submit(db, early, { data: dataMatching(4) }, 2);
    await db.update(bounties).set({ status: "judging" }).where(eq(bounties.id, bountyId));
    expect(await judgeBounty(db, bountyId, AFTER)).toBe("settled");
    expect((await bountyRow(db, bountyId)).winnerEntryId).toBe(early.entryId);

    const same = await openBounty(db);
    const a = await enter(db, same.bountyId);
    const b = await enter(db, same.bountyId);
    const subA = await submit(db, a, { data: dataMatching(5) }, 3);
    const subB = await submit(db, b, { data: dataMatching(5) }, 3);
    await db.update(bounties).set({ status: "judging" }).where(eq(bounties.id, same.bountyId));
    expect(await judgeBounty(db, same.bountyId, AFTER)).toBe("settled");
    const expected = subA.id < subB.id ? a.entryId : b.entryId;
    expect((await bountyRow(db, same.bountyId)).winnerEntryId).toBe(expected);
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("nobody passes: voided, escrow voided, every stake forfeit, no reward", async () => {
    const { bountyId } = await openBounty(db);
    const one = await enter(db, bountyId);
    const two = await enter(db, bountyId);
    const idle = await enter(db, bountyId);
    await submit(db, one, { data: dataMatching(2) }, 1);
    await submit(db, two, { data: { total: "not an integer" } }, 2);
    const feesBefore = await accountBalance(db, PLATFORM_FEES);

    expect(await sweepDeadlines(db, AFTER)).toBe(1);
    const bounty = await bountyRow(db, bountyId);
    expect(bounty).toMatchObject({ status: "voided", winnerEntryId: null });
    expect(bounty.settledAt).toEqual(AFTER);
    expect(await escrowStatus(db, bountyId)).toBe("voided");
    for (const e of [one, two, idle]) {
      expect(await balance(e)).toBe(4950n);
      expect((await entryRow(db, e.entryId)).stakeOutcome).toBe("forfeited");
    }
    expect(await accountBalance(db, PLATFORM_FEES)).toBe(feesBefore + 150n);
    expect(await accountBalance(db, stakeAccount(bountyId))).toBe(0n);
    const scores = await getJudgementsForBounty(db, bountyId);
    expect(scores.map((j) => j.score).sort()).toEqual([0, 40]);
    expect(await db.select().from(journals).where(eq(journals.refId, bountyId))).toHaveLength(0);
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("judging twice pays once", async () => {
    const { bountyId } = await openBounty(db);
    const winner = await enter(db, bountyId);
    const loser = await enter(db, bountyId);
    await submit(db, winner, { data: dataMatching(5) }, 1);
    await submit(db, loser, { data: dataMatching(1) }, 2);
    await sweepDeadlines(db, AFTER);
    const balances = [await balance(winner), await balance(loser)];
    const journalCount = (await db.select().from(journals)).length;
    const judgementCount = (await db.select().from(judgements)).length;

    expect(await judgeBounty(db, bountyId, at(70))).toBe("skipped");
    expect(await sweepDeadlines(db, at(70))).toBe(0);
    await Promise.all([judgeBounty(db, bountyId), judgeBounty(db, bountyId)]);

    expect([await balance(winner), await balance(loser)]).toEqual(balances);
    expect(await db.select().from(journals)).toHaveLength(journalCount);
    expect(await db.select().from(judgements)).toHaveLength(judgementCount);
    expect((await bountyRow(db, bountyId)).settledAt).toEqual(AFTER);
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("concurrent sweeps settle once", async () => {
    const { bountyId } = await openBounty(db);
    const winner = await enter(db, bountyId);
    await submit(db, winner, { data: dataMatching(5) }, 1);
    const moved = await Promise.all([1, 2, 3].map(() => sweepDeadlines(db, AFTER)));
    expect(moved.reduce((a, b) => a + b, 0)).toBe(1);
    // The reward is held once, for the dispute window.
    expect(await getBalances(db, winner.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 5000n });
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("no entries: voided, escrow voided", async () => {
    const { bountyId } = await openBounty(db);
    expect(await sweepDeadlines(db, AFTER)).toBe(1);
    expect(await bountyRow(db, bountyId)).toMatchObject({ status: "voided", winnerEntryId: null });
    expect(await escrowStatus(db, bountyId)).toBe("voided");
    expect((await getResultsFor(db, anyone, bountyId)).entries).toEqual([]);
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("only judges bounties in judging", async () => {
    const { bountyId } = await openBounty(db);
    expect(await judgeBounty(db, bountyId, AFTER)).toBe("skipped");
    expect(await judgeBounty(db, "bty_missing", AFTER)).toBe("skipped");
    expect((await bountyRow(db, bountyId)).status).toBe("open");
  });
});

describe("judgeBounty (creative_writing)", () => {
  it("waits 24 h for the poster's pick", async () => {
    const { bountyId } = await openBounty(db, { taskType: "creative_writing" });
    const e = await enter(db, bountyId);
    await submit(db, e, { text: "Lunch, but smarter." }, 1);
    expect(await sweepDeadlines(db, AFTER)).toBe(1);
    const bounty = await bountyRow(db, bountyId);
    expect(bounty).toMatchObject({ status: "judging", settledAt: null });
    expect(bounty.pickDeadlineAt).toEqual(new Date(AFTER.getTime() + PICK_WINDOW_MS));
    expect(await db.select().from(judgements)).toHaveLength(0);
    // Judging again keeps the deadline.
    expect(await judgeBounty(db, bountyId, at(120))).toBe("skipped");
    expect((await bountyRow(db, bountyId)).pickDeadlineAt).toEqual(bounty.pickDeadlineAt);
    expect(await escrowStatus(db, bountyId)).toBe("authorized");
  });
});

describe("sweepDeadlines resilience", () => {
  it("a bounty that fails to judge is reported and the others still settle", async () => {
    const posterId = await createUserWithWallet(db);
    // No escrow row: settling it throws.
    const broken = await createTestBounty(db, { posterId, deadlineAt: at(60), escrow: false });
    const { bountyId } = await openBounty(db);
    const winner = await enter(db, bountyId);
    await submit(db, winner, { data: dataMatching(5) }, 1);

    const errors: [unknown, string | undefined][] = [];
    expect(await sweepDeadlines(db, AFTER, (err, id) => errors.push([err, id]))).toBe(2);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.[1]).toBe(broken);
    expect(String(errors[0]?.[0])).toMatch(/has no escrow/);
    expect((await bountyRow(db, bountyId)).status).toBe("settled");
    expect(await bountyRow(db, broken)).toMatchObject({ status: "judging", settledAt: null });

    // Without a handler the sweep still tries every bounty, then throws; a later sweep retries the broken one.
    await expect(sweepDeadlines(db, at(62))).rejects.toThrow(/has no escrow/);
    await db.insert(escrows).values({ bountyId: broken, status: "authorized", dev: true });
    expect(await sweepDeadlines(db, at(63))).toBe(0);
    expect((await bountyRow(db, broken)).status).toBe("voided");
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });
});
