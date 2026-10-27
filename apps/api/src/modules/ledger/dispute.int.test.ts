// disp-01: the dispute hold. An auto-judged reward waits in hold:dispute:{bountyId}, then is released to the
// winner or refunded to the poster.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, createUserWithWallet, resetDb } from "../../../test/db";
import { accountBalance } from "./wallets";
import {
  disputeHoldAccount,
  getBalances,
  PAYPAL_CLEARING,
  payBountyReward,
  reconcile,
  refundDisputedReward,
  releaseDisputeHold,
} from "./index";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(() => resetDb(db));

async function heldReward() {
  const winner = await createUserWithWallet(db);
  const poster = await createUserWithWallet(db);
  await db.transaction((tx) =>
    payBountyReward(tx, {
      bountyId: "bty_d",
      winnerOwnerId: winner,
      rewardCents: 2500n,
      feeCents: 250n,
      idempotencyKey: "reward-bty_d",
      holdForDispute: true,
    }),
  );
  return { winner, poster };
}

describe("dispute hold", () => {
  it("holds the reward for the winner's owner: held, not spendable", async () => {
    const { winner } = await heldReward();
    expect(await getBalances(db, winner)).toEqual({ balanceCents: 0n, heldCents: 2500n });
    expect(await accountBalance(db, disputeHoldAccount("bty_d"))).toBe(2500n);
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("releases to the winner's wallet, once", async () => {
    const { winner } = await heldReward();
    const release = () =>
      db.transaction((tx) => releaseDisputeHold(tx, { bountyId: "bty_d", idempotencyKey: "dispute-release:bty_d" }));
    const first = await release();
    expect((await release()).id).toBe(first.id);
    expect(first.kind).toBe("release");
    expect(await getBalances(db, winner)).toEqual({ balanceCents: 2500n, heldCents: 0n });
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("refunds a real escrow's reward out through paypal:clearing", async () => {
    const { winner, poster } = await heldReward();
    const clearing = await accountBalance(db, PAYPAL_CLEARING);
    const refund = () =>
      db.transaction((tx) =>
        refundDisputedReward(tx, {
          bountyId: "bty_d",
          posterId: poster,
          toPosterWallet: false,
          idempotencyKey: "dispute-refund:dsp_1",
        }),
      );
    const first = await refund();
    expect((await refund()).id).toBe(first.id);
    expect(first.kind).toBe("refund");
    expect(await getBalances(db, winner)).toEqual({ balanceCents: 0n, heldCents: 0n });
    expect(await getBalances(db, poster)).toEqual({ balanceCents: 0n, heldCents: 0n });
    // accountBalance is credit - debit: crediting the clearing asset (money leaving PayPal) raises it.
    expect(await accountBalance(db, PAYPAL_CLEARING)).toBe(clearing + 2500n);
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("refunds a dev escrow's reward to the poster's wallet", async () => {
    const { winner, poster } = await heldReward();
    await db.transaction((tx) =>
      refundDisputedReward(tx, {
        bountyId: "bty_d",
        posterId: poster,
        toPosterWallet: true,
        idempotencyKey: "dispute-refund:dsp_2",
      }),
    );
    expect(await getBalances(db, winner)).toEqual({ balanceCents: 0n, heldCents: 0n });
    expect(await getBalances(db, poster)).toEqual({ balanceCents: 2500n, heldCents: 0n });
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("refuses to move a closed hold", async () => {
    const { poster } = await heldReward();
    await db.transaction((tx) => releaseDisputeHold(tx, { bountyId: "bty_d", idempotencyKey: "r1" }));
    await expect(
      db.transaction((tx) =>
        refundDisputedReward(tx, { bountyId: "bty_d", posterId: poster, toPosterWallet: true, idempotencyKey: "r2" }),
      ),
    ).rejects.toMatchObject({ code: "HOLD_NOT_OPEN" });
  });
});
