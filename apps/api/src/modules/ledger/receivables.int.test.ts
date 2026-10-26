import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, createUser, createUserWithWallet, resetDb, topUp } from "../../../test/db";
import { accountBalance } from "./wallets";
import {
  clawbackEscrow,
  clawbackTopup,
  creditTopup,
  getBalances,
  hold,
  LedgerError,
  owedCents,
  PAYPAL_CLEARING,
  PLATFORM_FEES,
  receivableAccount,
  reconcile,
} from "./index";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(() => resetDb(db));

const expectReconciled = async () => expect(await reconcile(db)).toMatchObject({ ok: true });
const balance = async (owner: string) => (await getBalances(db, owner)).balanceCents;
const fees = () => accountBalance(db, PLATFORM_FEES);
const clearing = async () => -(await accountBalance(db, PAYPAL_CLEARING)); // asset: debits - credits

const credit = (ownerId: string, cents: bigint, feeCents: bigint, key = "topup:tup_1") =>
  db.transaction((tx) => creditTopup(tx, { topupId: "tup_1", ownerId, cents, feeCents, idempotencyKey: key }));

const claw = (ownerId: string, cents: bigint, already: bigint, key: string, creditCents = 500n, feeCents = 69n) =>
  db.transaction((tx) =>
    clawbackTopup(tx, {
      topupId: "tup_1",
      ownerId,
      cents,
      creditCents,
      feeCents,
      alreadyClawedCents: already,
      idempotencyKey: key,
    }),
  );

describe("creditTopup", () => {
  it("credits the wallet and the fee once per key, and balances", async () => {
    const owner = await createUserWithWallet(db);
    const first = await credit(owner, 500n, 69n);
    const again = await credit(owner, 500n, 69n);
    expect(first).toMatchObject({ kind: "topup", replayed: false });
    expect(again).toMatchObject({ id: first.id, replayed: true });
    expect(await getBalances(db, owner)).toEqual({ balanceCents: 500n, heldCents: 0n });
    expect(await fees()).toBe(69n);
    expect(await clearing()).toBe(569n);
    await expectReconciled();
  });

  it("works without a fee and rejects bad amounts", async () => {
    const owner = await createUserWithWallet(db);
    await credit(owner, 700n, 0n);
    expect(await balance(owner)).toBe(700n);
    for (const [cents, fee] of [
      [0n, 10n],
      [100n, -1n],
    ] as const) {
      const err = await credit(owner, cents, fee, `bad-${cents}`).catch((e: unknown) => e);
      expect((err as LedgerError).code).toBe("INVALID_AMOUNT");
    }
  });

  it("repays an open receivable first, then credits the rest", async () => {
    const owner = await createUserWithWallet(db);
    await credit(owner, 500n, 69n);
    await claw(owner, 569n, 0n, "clawback:R1"); // whole wallet gone; nothing owed yet
    expect(await owedCents(db, owner)).toBe(0n);

    // Spend the next top-up first, then reverse it: 300 is owed.
    await credit(owner, 500n, 69n, "topup:tup_2");
    await db.transaction((tx) =>
      hold(tx, { ownerId: owner, spendRequestId: "spr_1", amountCents: 300n, idempotencyKey: "h1" }),
    );
    const r = await claw(owner, 500n, 0n, "clawback:R2");
    expect(r).toMatchObject({ clawedCents: 500n, owedCents: 300n });
    expect(await getBalances(db, owner)).toEqual({ balanceCents: 0n, heldCents: 300n });

    // 200 repays part of the debt and credits nothing.
    await credit(owner, 200n, 55n, "topup:tup_3");
    expect(await owedCents(db, owner)).toBe(100n);
    expect(await balance(owner)).toBe(0n);
    // 500 repays the rest and credits 400.
    await credit(owner, 500n, 69n, "topup:tup_4");
    expect(await owedCents(db, owner)).toBe(0n);
    expect(await balance(owner)).toBe(400n);
    expect(await accountBalance(db, receivableAccount(owner))).toBe(0n);
    await expectReconciled();
  });
});

describe("clawbackTopup", () => {
  it("takes the credit part from the wallet when it covers it", async () => {
    const owner = await createUserWithWallet(db);
    await credit(owner, 500n, 69n);
    await topUp(db, owner, 1000n);
    const r = await claw(owner, 500n, 0n, "clawback:R1");
    expect(r).toMatchObject({ clawedCents: 500n, owedCents: 0n });
    expect(r.journal).toMatchObject({ kind: "clawback", refType: "topup", refId: "tup_1", replayed: false });
    expect(await balance(owner)).toBe(1000n);
    expect(await fees()).toBe(69n);
    await expectReconciled();
  });

  it("puts what the wallet can't cover on a receivable, leaving holds alone", async () => {
    const owner = await createUserWithWallet(db);
    await credit(owner, 500n, 69n);
    await db.transaction((tx) =>
      hold(tx, { ownerId: owner, spendRequestId: "spr_1", amountCents: 380n, idempotencyKey: "h1" }),
    );
    const r = await claw(owner, 500n, 0n, "clawback:R1");
    expect(r).toMatchObject({ clawedCents: 500n, owedCents: 380n });
    expect(await getBalances(db, owner)).toEqual({ balanceCents: 0n, heldCents: 380n });
    await expectReconciled();
    const check = (await reconcile(db)).checks.find((c) => c.name === "receivables");
    expect(check).toMatchObject({ ok: true, detail: `1 owing: ${owner} owes 380` });
  });

  it("is idempotent per key", async () => {
    const owner = await createUserWithWallet(db);
    await credit(owner, 500n, 69n);
    const first = await claw(owner, 200n, 0n, "clawback:R1");
    const again = await claw(owner, 200n, 200n, "clawback:R1");
    expect(again).toMatchObject({ clawedCents: 0n, owedCents: 0n });
    expect(again.journal).toMatchObject({ id: first.journal!.id, replayed: true });
    expect(await balance(owner)).toBe(300n);
    await expectReconciled();
  });

  it("takes the part above the credit from platform:fees and never more than the charge", async () => {
    const owner = await createUserWithWallet(db);
    await credit(owner, 500n, 69n);
    await claw(owner, 450n, 0n, "clawback:R1");
    // 119 more: 50 credit part, 69 fee part. Then 100 more is beyond the charge.
    const r = await claw(owner, 200n, 450n, "clawback:R2");
    expect(r.clawedCents).toBe(119n);
    expect(await balance(owner)).toBe(0n);
    expect(await fees()).toBe(0n);
    expect(await claw(owner, 100n, 569n, "clawback:R3")).toMatchObject({ journal: null, clawedCents: 0n });
    expect(await clearing()).toBe(0n);
    await expectReconciled();
  });
});

describe("clawbackEscrow", () => {
  it("puts the whole amount on the poster's receivable, once per key, and opens their wallet", async () => {
    const poster = await createUser(db);
    const input = { bountyId: "bty_1", posterId: poster, cents: 1650n, idempotencyKey: "clawback:R9" };
    const first = await db.transaction((tx) => clawbackEscrow(tx, input));
    const again = await db.transaction((tx) => clawbackEscrow(tx, input));
    expect(first).toMatchObject({ clawedCents: 1650n, owedCents: 1650n });
    expect(first.journal).toMatchObject({ kind: "clawback", refType: "bounty", refId: "bty_1" });
    expect(again).toMatchObject({ clawedCents: 0n, owedCents: 1650n });
    expect(await owedCents(db, poster)).toBe(1650n);
    expect(await balance(poster)).toBe(0n);
    await expectReconciled();
    // A top-up repays it.
    await credit(poster, 2000n, 0n, "topup:tup_9");
    expect(await owedCents(db, poster)).toBe(0n);
    expect(await balance(poster)).toBe(350n);
    await expectReconciled();
  });
});
