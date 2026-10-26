import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { at, bountyRow, dataMatching, enter, entryRow, escrowStatus, openBounty, submit } from "../../../test/arena";
import { createTestDb, resetDb } from "../../../test/db";
import { bounties } from "../../db/schema";
import type { UserPrincipal } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { getJudgementsForBounty } from "../judge";
import { getBalances, PLATFORM_FEES, reconcile, stakeAccount } from "../ledger";
import { accountBalance } from "../ledger/wallets";
import { PICK_WINDOW_MS, pickWinner, registerArenaHooks, runPickFallbacks, sweepDeadlines } from "./index";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(async () => {
  await resetDb(db);
  registerArenaHooks();
});

const AFTER = at(61);
const PICK_DEADLINE = new Date(AFTER.getTime() + PICK_WINDOW_MS);
const userP = (userId: string): UserPrincipal => ({ type: "user", userId, email: "x@test.local", roles: [] });

async function code(p: Promise<unknown>): Promise<string> {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  if (!(err instanceof ApiError)) throw err ?? new Error("expected an ApiError");
  return err.code;
}

// A creative_writing bounty in judging with three submitters (minutes 3, 1, 2) and one entrant who never submitted.
async function judgingCreative() {
  const { bountyId, posterId } = await openBounty(db, { taskType: "creative_writing" });
  const a = await enter(db, bountyId);
  const b = await enter(db, bountyId);
  const c = await enter(db, bountyId);
  const idle = await enter(db, bountyId);
  await submit(db, a, { text: "Lunch, but smarter." }, 3);
  await submit(db, b, { text: "Eat like an agent." }, 1);
  await submit(db, c, { text: "Gotta eat." }, 2);
  expect(await sweepDeadlines(db, AFTER)).toBe(1);
  return { bountyId, posterId, poster: userP(posterId), a, b, c, idle };
}

describe("pickWinner", () => {
  it("the poster's pick settles: reward to the winner, every submitter refunded", async () => {
    const w = await judgingCreative();
    const feesBefore = await accountBalance(db, PLATFORM_FEES);
    const results = await pickWinner(db, w.poster, w.bountyId, w.a.entryId, at(90));

    expect(results).toMatchObject({ bountyId: w.bountyId, status: "settled", winnerEntryId: w.a.entryId });
    expect(results.settledAt).toBe(at(90).toISOString());
    const byEntry = new Map(results.entries.map((e) => [e.entryId, e]));
    expect(byEntry.get(w.a.entryId)).toMatchObject({ score: 100, passed: true, stakeOutcome: "refunded" });
    for (const e of [w.b, w.c]) {
      expect(byEntry.get(e.entryId)).toMatchObject({ score: null, passed: true, stakeOutcome: "refunded" });
    }
    expect(byEntry.get(w.idle.entryId)).toMatchObject({ score: null, passed: false, stakeOutcome: "forfeited" });

    expect((await getBalances(db, w.a.ownerId)).balanceCents).toBe(10_000n);
    for (const e of [w.b, w.c]) expect((await getBalances(db, e.ownerId)).balanceCents).toBe(5000n);
    expect((await getBalances(db, w.idle.ownerId)).balanceCents).toBe(4950n);
    expect(await accountBalance(db, PLATFORM_FEES)).toBe(feesBefore + 500n + 50n);
    expect(await accountBalance(db, stakeAccount(w.bountyId))).toBe(0n);
    expect(await escrowStatus(db, w.bountyId)).toBe("captured");
    const [j] = await getJudgementsForBounty(db, w.bountyId);
    expect(j).toMatchObject({ entryId: w.a.entryId, verifier: "poster_pick", score: 100 });

    // Settled: a second pick and the fallback do nothing.
    expect(await code(pickWinner(db, w.poster, w.bountyId, w.b.entryId))).toBe("not_judging");
    expect(await runPickFallbacks(db, new Date(PICK_DEADLINE.getTime() + 1000))).toBe(0);
    expect((await getBalances(db, w.a.ownerId)).balanceCents).toBe(10_000n);
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("404 for anyone but the poster or a missing bounty", async () => {
    const w = await judgingCreative();
    expect(await code(pickWinner(db, userP(w.a.ownerId), w.bountyId, w.a.entryId))).toBe("not_found");
    expect(await code(pickWinner(db, w.poster, "bty_missing", w.a.entryId))).toBe("not_found");
    expect((await bountyRow(db, w.bountyId)).status).toBe("judging");
  });

  it("409 not_poster_judged for extract_data", async () => {
    const { bountyId, posterId } = await openBounty(db);
    const e = await enter(db, bountyId);
    await submit(db, e, { data: dataMatching(1) }, 1);
    await db.update(bounties).set({ status: "judging" }).where(eq(bounties.id, bountyId));
    expect(await code(pickWinner(db, userP(posterId), bountyId, e.entryId))).toBe("not_poster_judged");
  });

  it("409 not_judging while open", async () => {
    const { bountyId, posterId } = await openBounty(db, { taskType: "creative_writing" });
    const e = await enter(db, bountyId);
    await submit(db, e, { text: "Early bird." }, 1);
    expect(await code(pickWinner(db, userP(posterId), bountyId, e.entryId))).toBe("not_judging");
  });

  it("409 entry_not_submitted; 404 for an entry of another bounty", async () => {
    const w = await judgingCreative();
    expect(await code(pickWinner(db, w.poster, w.bountyId, w.idle.entryId))).toBe("entry_not_submitted");
    const other = await openBounty(db, { taskType: "creative_writing" });
    const stranger = await enter(db, other.bountyId);
    expect(await code(pickWinner(db, w.poster, w.bountyId, stranger.entryId))).toBe("not_found");
    expect(await code(pickWinner(db, w.poster, w.bountyId, "ent_missing"))).toBe("not_found");
    expect((await bountyRow(db, w.bountyId)).status).toBe("judging");
  });
});

describe("runPickFallbacks", () => {
  it("after the pick deadline the earliest submission wins", async () => {
    const w = await judgingCreative();
    expect(await runPickFallbacks(db, new Date(PICK_DEADLINE.getTime() - 1000))).toBe(0);
    expect((await bountyRow(db, w.bountyId)).status).toBe("judging");

    // The sweep runs the fallback.
    const later = new Date(PICK_DEADLINE.getTime() + 1000);
    expect(await sweepDeadlines(db, later)).toBe(0);
    const bounty = await bountyRow(db, w.bountyId);
    expect(bounty).toMatchObject({ status: "settled", winnerEntryId: w.b.entryId });
    expect(bounty.settledAt).toEqual(later);
    const [j] = await getJudgementsForBounty(db, w.bountyId);
    expect(j).toMatchObject({ entryId: w.b.entryId, verifier: "fallback_earliest", score: 100 });
    expect((await getBalances(db, w.b.ownerId)).balanceCents).toBe(10_000n);
    for (const e of [w.a, w.c]) expect((await entryRow(db, e.entryId)).stakeOutcome).toBe("refunded");
    expect((await entryRow(db, w.idle.entryId)).stakeOutcome).toBe("forfeited");
    expect(await code(pickWinner(db, w.poster, w.bountyId, w.a.entryId))).toBe("not_judging");
    expect(await runPickFallbacks(db, later)).toBe(0);
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("no submissions: voided, stakes forfeit", async () => {
    const { bountyId } = await openBounty(db, { taskType: "creative_writing" });
    const idle = await enter(db, bountyId);
    await sweepDeadlines(db, AFTER);
    expect(await runPickFallbacks(db, new Date(PICK_DEADLINE.getTime() + 1000))).toBe(1);
    expect(await bountyRow(db, bountyId)).toMatchObject({ status: "voided", winnerEntryId: null });
    expect(await escrowStatus(db, bountyId)).toBe("voided");
    expect((await entryRow(db, idle.entryId)).stakeOutcome).toBe("forfeited");
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });
});
