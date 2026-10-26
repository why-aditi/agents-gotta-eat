import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, createUserWithWallet, resetDb, topUp } from "../../../test/db";
import { accountBalance } from "./wallets";
import {
  PAYPAL_CLEARING,
  creditTopup,
  getBalances,
  holdWithdrawal,
  LedgerError,
  reconcile,
  returnWithdrawal,
  settleWithdrawal,
  withdrawalAccount,
} from "./index";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(() => resetDb(db));

const hold = (ownerId: string, cents: bigint, key = "w-hold") =>
  db.transaction((tx) => holdWithdrawal(tx, { payoutId: "pay_1", ownerId, cents, idempotencyKey: key }));

describe("creditTopup", () => {
  it("credits the wallet once per key", async () => {
    const owner = await createUserWithWallet(db);
    const input = { topupId: "tup_1", ownerId: owner, cents: 700n, idempotencyKey: "t-1" };
    const first = await db.transaction((tx) => creditTopup(tx, input));
    const again = await db.transaction((tx) => creditTopup(tx, input));
    expect(first).toMatchObject({ kind: "topup", replayed: false });
    expect(again).toMatchObject({ id: first.id, replayed: true });
    expect(await getBalances(db, owner)).toEqual({ balanceCents: 700n, heldCents: 0n });
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("rejects non-positive amounts", async () => {
    const owner = await createUserWithWallet(db);
    const err = await db
      .transaction((tx) => creditTopup(tx, { topupId: "tup_1", ownerId: owner, cents: 0n, idempotencyKey: "t-0" }))
      .catch((e: unknown) => e);
    expect((err as LedgerError).code).toBe("INVALID_AMOUNT");
  });
});

describe("withdrawals", () => {
  it("hold lowers the balance and is idempotent", async () => {
    const owner = await createUserWithWallet(db);
    await topUp(db, owner, 1000n);
    const first = await hold(owner, 400n);
    expect(first.kind).toBe("withdrawal");
    expect(await hold(owner, 400n)).toMatchObject({ id: first.id, replayed: true });
    expect(await getBalances(db, owner)).toEqual({ balanceCents: 600n, heldCents: 0n });
    expect(await accountBalance(db, withdrawalAccount("pay_1"))).toBe(400n);
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("hold fails when the wallet cannot cover it", async () => {
    const owner = await createUserWithWallet(db);
    await topUp(db, owner, 100n);
    const err = await hold(owner, 101n).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LedgerError);
    expect((err as LedgerError).code).toBe("INSUFFICIENT_FUNDS");
    expect(await getBalances(db, owner)).toEqual({ balanceCents: 100n, heldCents: 0n });
  });

  it("rejects non-positive amounts", async () => {
    const owner = await createUserWithWallet(db);
    const err = await hold(owner, -5n).catch((e: unknown) => e);
    expect((err as LedgerError).code).toBe("INVALID_AMOUNT");
  });

  it("settle sends the cents to paypal:clearing, once", async () => {
    const owner = await createUserWithWallet(db);
    await topUp(db, owner, 1000n);
    await hold(owner, 400n);
    const input = { payoutId: "pay_1", cents: 400n, idempotencyKey: "w-settle" };
    const first = await db.transaction((tx) => settleWithdrawal(tx, input));
    const again = await db.transaction((tx) => settleWithdrawal(tx, input));
    expect(first.kind).toBe("payout");
    expect(again).toMatchObject({ id: first.id, replayed: true });
    expect(await getBalances(db, owner)).toEqual({ balanceCents: 600n, heldCents: 0n });
    expect(await accountBalance(db, withdrawalAccount("pay_1"))).toBe(0n);
    // clearing is an asset: the top-up debited 1000, the settle credited 400 back (liability sign: credits - debits).
    expect(await accountBalance(db, PAYPAL_CLEARING)).toBe(-600n);
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("return restores the wallet exactly, once", async () => {
    const owner = await createUserWithWallet(db);
    await topUp(db, owner, 1000n);
    await hold(owner, 400n);
    const input = { payoutId: "pay_1", ownerId: owner, cents: 400n, idempotencyKey: "w-return" };
    const first = await db.transaction((tx) => returnWithdrawal(tx, input));
    const again = await db.transaction((tx) => returnWithdrawal(tx, input));
    expect(first.kind).toBe("withdrawal_return");
    expect(again).toMatchObject({ id: first.id, replayed: true });
    expect(await getBalances(db, owner)).toEqual({ balanceCents: 1000n, heldCents: 0n });
    expect(await accountBalance(db, withdrawalAccount("pay_1"))).toBe(0n);
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("a payout leaves its hold once: no second settle, no return after settle, no unknown hold", async () => {
    const owner = await createUserWithWallet(db);
    await topUp(db, owner, 1000n);
    await hold(owner, 400n);
    await db.transaction((tx) => settleWithdrawal(tx, { payoutId: "pay_1", cents: 400n, idempotencyKey: "s1" }));
    const second = await db
      .transaction((tx) => settleWithdrawal(tx, { payoutId: "pay_1", cents: 400n, idempotencyKey: "s2" }))
      .catch((e: unknown) => e);
    const back = await db
      .transaction((tx) =>
        returnWithdrawal(tx, { payoutId: "pay_1", ownerId: owner, cents: 400n, idempotencyKey: "r1" }),
      )
      .catch((e: unknown) => e);
    const unknown = await db
      .transaction((tx) => settleWithdrawal(tx, { payoutId: "nope", cents: 1n, idempotencyKey: "s3" }))
      .catch((e: unknown) => e);
    expect((second as LedgerError).code).toBe("INSUFFICIENT_FUNDS");
    expect((back as LedgerError).code).toBe("INSUFFICIENT_FUNDS");
    expect((unknown as LedgerError).code).toBe("UNKNOWN_ACCOUNT");
    expect(await getBalances(db, owner)).toEqual({ balanceCents: 600n, heldCents: 0n });
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });
});
