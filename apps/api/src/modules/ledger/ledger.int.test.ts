import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, createUserWithWallet, resetDb, topUp } from "../../../test/db";
import { journals, ledgerEntries, wallets } from "../../db/schema";
import { newId } from "../../lib/ids";
import {
  getBalances,
  hold,
  LedgerError,
  PLATFORM_FEES,
  reconcile,
  release,
  settle,
  subcontractFee,
  walletAccount,
} from "./index";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(() => resetDb(db));

async function cache(ownerId: string) {
  const [row] = await db.select().from(wallets).where(eq(wallets.ownerId, ownerId));
  return { balanceCents: row!.balanceCents, heldCents: row!.heldCents };
}

async function expectBalances(ownerId: string, balanceCents: bigint, heldCents: bigint) {
  expect(await getBalances(db, ownerId)).toEqual({ balanceCents, heldCents });
  expect(await cache(ownerId)).toEqual({ balanceCents, heldCents });
}

async function ledgerError(p: Promise<unknown>) {
  const err = await p.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(LedgerError);
  return (err as LedgerError).code;
}

// Drizzle wraps driver errors; the Postgres message is on `cause`.
async function pgError(p: Promise<unknown>) {
  const err = await p.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(Error);
  return ((err as Error).cause as Error | undefined)?.message ?? (err as Error).message;
}

async function count(table: typeof journals | typeof ledgerEntries) {
  const [row] = await db.select({ n: sql<string>`count(*)` }).from(table);
  return BigInt(row!.n);
}

async function feesBalance() {
  const [row] = await db
    .select({ b: sql<string>`coalesce(sum(credit_cents - debit_cents), 0)::bigint` })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.accountId, PLATFORM_FEES));
  return BigInt(row!.b);
}

describe("ledger", () => {
  it("top-up, hold, settle and release keep balances and the cache right", async () => {
    const a = await createUserWithWallet(db);
    const b = await createUserWithWallet(db);
    await expectBalances(a, 0n, 0n);

    await topUp(db, a, 5000n);
    await expectBalances(a, 5000n, 0n);

    await db.transaction((tx) =>
      hold(tx, { ownerId: a, spendRequestId: "sr_1", amountCents: 1000n, idempotencyKey: "h1" }),
    );
    await expectBalances(a, 4000n, 1000n);

    await db.transaction((tx) =>
      settle(tx, { spendRequestId: "sr_1", payeeOwnerId: b, amountCents: 980n, feeCents: 20n, idempotencyKey: "s1" }),
    );
    await expectBalances(a, 4000n, 0n);
    await expectBalances(b, 980n, 0n);
    expect(await feesBalance()).toBe(20n);

    await db.transaction((tx) =>
      hold(tx, { ownerId: a, spendRequestId: "sr_2", amountCents: 1500n, idempotencyKey: "h2" }),
    );
    await expectBalances(a, 2500n, 1500n);

    await db.transaction((tx) => release(tx, { spendRequestId: "sr_2", idempotencyKey: "r2" }));
    await expectBalances(a, 4000n, 0n);

    expect((await reconcile(db)).ok).toBe(true);
  });

  it("runs the spec's worked example: hire B for $8.00 + $0.16 fee", async () => {
    const a = await createUserWithWallet(db);
    const b = await createUserWithWallet(db);
    await topUp(db, a, 2000n);

    const amount = 800n;
    const fee = subcontractFee(amount);
    expect(fee).toBe(16n);

    await db.transaction((tx) =>
      hold(tx, { ownerId: a, spendRequestId: "sr_1", amountCents: amount + fee, idempotencyKey: "hire-sr_1" }),
    );
    await expectBalances(a, 1184n, 816n);

    await db.transaction((tx) =>
      settle(tx, {
        spendRequestId: "sr_1",
        payeeOwnerId: b,
        amountCents: amount,
        feeCents: fee,
        idempotencyKey: "settle-sr_1",
      }),
    );
    await expectBalances(a, 1184n, 0n);
    await expectBalances(b, 800n, 0n);
    expect(await feesBalance()).toBe(16n);
    expect((await reconcile(db)).ok).toBe(true);
  });

  it("returns the original journal for a duplicate idempotency key and writes nothing", async () => {
    const a = await createUserWithWallet(db);
    const first = await topUp(db, a, 500n, "topup-1");
    expect(first.replayed).toBe(false);
    const journalsBefore = await count(journals);
    const entriesBefore = await count(ledgerEntries);

    const again = await topUp(db, a, 999n, "topup-1");
    expect(again.replayed).toBe(true);
    expect(again.id).toBe(first.id);

    const h1 = await db.transaction((tx) =>
      hold(tx, { ownerId: a, spendRequestId: "sr_1", amountCents: 500n, idempotencyKey: "hold-1" }),
    );
    // A replay must not trip the balance check, even though the wallet is now empty.
    const h2 = await db.transaction((tx) =>
      hold(tx, { ownerId: a, spendRequestId: "sr_1", amountCents: 500n, idempotencyKey: "hold-1" }),
    );
    expect(h2).toMatchObject({ id: h1.id, replayed: true });

    const r1 = await db.transaction((tx) => release(tx, { spendRequestId: "sr_1", idempotencyKey: "rel-1" }));
    const r2 = await db.transaction((tx) => release(tx, { spendRequestId: "sr_1", idempotencyKey: "rel-1" }));
    expect(r2).toMatchObject({ id: r1.id, replayed: true });

    expect(await count(journals)).toBe(journalsBefore + 2n);
    expect(await count(ledgerEntries)).toBe(entriesBefore + 4n);
    await expectBalances(a, 500n, 0n);
  });

  it("rejects a hold larger than the balance", async () => {
    const a = await createUserWithWallet(db);
    await topUp(db, a, 100n);
    expect(
      await ledgerError(
        db.transaction((tx) =>
          hold(tx, { ownerId: a, spendRequestId: "sr_1", amountCents: 101n, idempotencyKey: "h" }),
        ),
      ),
    ).toBe("INSUFFICIENT_FUNDS");
    await expectBalances(a, 100n, 0n);
  });

  it("rejects bad amounts and unknown accounts", async () => {
    const a = await createUserWithWallet(db);
    await topUp(db, a, 100n);
    expect(
      await ledgerError(
        db.transaction((tx) => hold(tx, { ownerId: a, spendRequestId: "sr_1", amountCents: 0n, idempotencyKey: "h" })),
      ),
    ).toBe("INVALID_AMOUNT");
    expect(
      await ledgerError(
        db.transaction((tx) =>
          hold(tx, { ownerId: "usr_nobody", spendRequestId: "sr_1", amountCents: 1n, idempotencyKey: "h" }),
        ),
      ),
    ).toBe("UNKNOWN_ACCOUNT");
    expect(await ledgerError(topUp(db, "usr_nobody", 100n))).toBe("UNKNOWN_ACCOUNT");

    await db.transaction((tx) =>
      hold(tx, { ownerId: a, spendRequestId: "sr_1", amountCents: 50n, idempotencyKey: "h1" }),
    );
    expect(
      await ledgerError(
        db.transaction((tx) =>
          settle(tx, { spendRequestId: "sr_1", payeeOwnerId: a, amountCents: 40n, feeCents: 5n, idempotencyKey: "s" }),
        ),
      ),
    ).toBe("INVALID_AMOUNT");
  });

  it("fails settle and release on a closed hold", async () => {
    const a = await createUserWithWallet(db);
    const b = await createUserWithWallet(db);
    await topUp(db, a, 1000n);
    await db.transaction((tx) =>
      hold(tx, { ownerId: a, spendRequestId: "sr_1", amountCents: 300n, idempotencyKey: "h1" }),
    );
    await db.transaction((tx) => release(tx, { spendRequestId: "sr_1", idempotencyKey: "r1" }));

    expect(
      await ledgerError(db.transaction((tx) => release(tx, { spendRequestId: "sr_1", idempotencyKey: "r2" }))),
    ).toBe("HOLD_NOT_OPEN");
    expect(
      await ledgerError(
        db.transaction((tx) =>
          settle(tx, { spendRequestId: "sr_1", payeeOwnerId: b, amountCents: 300n, feeCents: 0n, idempotencyKey: "s" }),
        ),
      ),
    ).toBe("HOLD_NOT_OPEN");

    await db.transaction((tx) =>
      hold(tx, { ownerId: a, spendRequestId: "sr_2", amountCents: 300n, idempotencyKey: "h2" }),
    );
    await db.transaction((tx) =>
      settle(tx, { spendRequestId: "sr_2", payeeOwnerId: b, amountCents: 300n, feeCents: 0n, idempotencyKey: "s2" }),
    );
    expect(
      await ledgerError(db.transaction((tx) => release(tx, { spendRequestId: "sr_2", idempotencyKey: "r3" }))),
    ).toBe("HOLD_NOT_OPEN");
    await expectBalances(a, 700n, 0n);
    await expectBalances(b, 300n, 0n);
  });

  it("rejects raw UPDATE and DELETE on ledger_entries and journals", async () => {
    const a = await createUserWithWallet(db);
    await topUp(db, a, 100n);
    expect(await pgError(db.execute(sql`update ledger_entries set credit_cents = 1000000`))).toMatch(/append-only/);
    expect(await pgError(db.execute(sql`delete from ledger_entries`))).toMatch(/append-only/);
    expect(await pgError(db.execute(sql`update journals set ref_id = 'x'`))).toMatch(/append-only/);
    expect(await pgError(db.execute(sql`delete from journals`))).toMatch(/append-only/);
    await expectBalances(a, 100n, 0n);
  });

  it("fails at commit when a raw insert leaves a journal unbalanced", async () => {
    const a = await createUserWithWallet(db);
    const jnl = newId("jnl");
    expect(
      await pgError(
        db.transaction(async (tx) => {
          await tx.insert(journals).values({ id: jnl, kind: "topup", idempotencyKey: "raw" });
          await tx.insert(ledgerEntries).values([
            { id: newId("len"), journalId: jnl, accountId: "paypal:clearing", debitCents: 100n },
            { id: newId("len"), journalId: jnl, accountId: walletAccount(a), creditCents: 99n },
          ]);
        }),
      ),
    ).toMatch(/unbalanced/);

    const lone = newId("jnl");
    expect(
      await pgError(
        db.transaction(async (tx) => {
          await tx.insert(journals).values({ id: lone, kind: "topup", idempotencyKey: "raw-2" });
          await tx
            .insert(ledgerEntries)
            .values({ id: newId("len"), journalId: lone, accountId: walletAccount(a), creditCents: 5n });
        }),
      ),
    ).toMatch(/unbalanced/);

    expect(await count(journals)).toBe(0n);
    expect((await reconcile(db)).ok).toBe(true);
  });

  it("reconcile reports a stale wallet cache", async () => {
    const a = await createUserWithWallet(db);
    await topUp(db, a, 100n);
    await db.update(wallets).set({ balanceCents: 5n }).where(eq(wallets.ownerId, a));
    const result = await reconcile(db);
    expect(result.ok).toBe(false);
    expect(result.checks.find((c) => c.name === "wallet_cache")?.ok).toBe(false);
  });
});
