import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, createUserWithWallet, resetDb, topUp } from "../../../test/db";
import { accountBalance } from "./wallets";
import { getBalances, hold, LedgerError, reconcile, release, stakeAccount, stakeFromHold } from "./index";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(() => resetDb(db));

describe("stakeFromHold", () => {
  it("moves the whole hold into the bounty's stake account, once", async () => {
    const owner = await createUserWithWallet(db);
    await topUp(db, owner, 1000n);
    await db.transaction((tx) =>
      hold(tx, { ownerId: owner, spendRequestId: "spr_a", amountCents: 50n, idempotencyKey: "h-a" }),
    );
    const first = await db.transaction((tx) =>
      stakeFromHold(tx, { spendRequestId: "spr_a", bountyId: "bty_1", idempotencyKey: "s-a" }),
    );
    expect(first.kind).toBe("stake");
    const replay = await db.transaction((tx) =>
      stakeFromHold(tx, { spendRequestId: "spr_a", bountyId: "bty_1", idempotencyKey: "s-a" }),
    );
    expect(replay).toMatchObject({ id: first.id, replayed: true });

    expect(await getBalances(db, owner)).toEqual({ balanceCents: 950n, heldCents: 0n });
    expect(await accountBalance(db, stakeAccount("bty_1"))).toBe(50n);
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("refuses a hold that is already closed", async () => {
    const owner = await createUserWithWallet(db);
    await topUp(db, owner, 1000n);
    await db.transaction((tx) =>
      hold(tx, { ownerId: owner, spendRequestId: "spr_b", amountCents: 50n, idempotencyKey: "h-b" }),
    );
    await db.transaction((tx) => release(tx, { spendRequestId: "spr_b", idempotencyKey: "r-b" }));
    const err = await db
      .transaction((tx) => stakeFromHold(tx, { spendRequestId: "spr_b", bountyId: "bty_1", idempotencyKey: "s-b" }))
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LedgerError);
    expect((err as LedgerError).code).toBe("HOLD_NOT_OPEN");
  });
});
