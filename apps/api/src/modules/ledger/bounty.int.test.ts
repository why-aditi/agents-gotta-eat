import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, createUserWithWallet, resetDb, topUp } from "../../../test/db";
import { accountBalance } from "./wallets";
import {
  forfeitStake,
  getBalances,
  hold,
  PLATFORM_FEES,
  payBountyReward,
  reconcile,
  refundStake,
  stakeAccount,
  stakeFromHold,
} from "./index";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(() => resetDb(db));

async function stakeFor(ownerId: string, bountyId: string, sr: string) {
  await topUp(db, ownerId, 1000n);
  await db.transaction(async (tx) => {
    await hold(tx, { ownerId, spendRequestId: sr, amountCents: 50n, idempotencyKey: `h-${sr}` });
    await stakeFromHold(tx, { spendRequestId: sr, bountyId, idempotencyKey: `s-${sr}` });
  });
}

describe("bounty settlement journals", () => {
  it("pays the reward to the winner and the fee to the platform, once", async () => {
    const winner = await createUserWithWallet(db);
    const fees = await accountBalance(db, PLATFORM_FEES);
    const pay = () =>
      db.transaction((tx) =>
        payBountyReward(tx, {
          bountyId: "bty_1",
          winnerOwnerId: winner,
          rewardCents: 5000n,
          feeCents: 500n,
          idempotencyKey: "reward-bty_1",
        }),
      );
    const first = await pay();
    expect((await pay()).id).toBe(first.id);
    expect(await getBalances(db, winner)).toEqual({ balanceCents: 5000n, heldCents: 0n });
    expect(await accountBalance(db, PLATFORM_FEES)).toBe(fees + 500n);
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("refunds one stake and forfeits another, leaving the stake account empty", async () => {
    const a = await createUserWithWallet(db);
    const b = await createUserWithWallet(db);
    await stakeFor(a, "bty_2", "spr_a");
    await stakeFor(b, "bty_2", "spr_b");
    expect(await accountBalance(db, stakeAccount("bty_2"))).toBe(100n);
    const fees = await accountBalance(db, PLATFORM_FEES);

    await db.transaction(async (tx) => {
      await refundStake(tx, { bountyId: "bty_2", entryId: "ent_a", ownerId: a, cents: 50n, idempotencyKey: "r-a" });
      await forfeitStake(tx, { bountyId: "bty_2", entryId: "ent_b", cents: 50n, idempotencyKey: "f-b" });
    });
    // Replays write nothing.
    await db.transaction(async (tx) => {
      await refundStake(tx, { bountyId: "bty_2", entryId: "ent_a", ownerId: a, cents: 50n, idempotencyKey: "r-a" });
      await forfeitStake(tx, { bountyId: "bty_2", entryId: "ent_b", cents: 50n, idempotencyKey: "f-b" });
    });

    expect(await getBalances(db, a)).toEqual({ balanceCents: 1000n, heldCents: 0n });
    expect(await getBalances(db, b)).toEqual({ balanceCents: 950n, heldCents: 0n });
    expect(await accountBalance(db, stakeAccount("bty_2"))).toBe(0n);
    expect(await accountBalance(db, PLATFORM_FEES)).toBe(fees + 50n);
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });
});
