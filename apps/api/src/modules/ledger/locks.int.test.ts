// perf-01: lockWallet remembers the rows a transaction locked, and only inside a real transaction.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, createUserWithWallet, resetDb, topUp } from "../../../test/db";
import { lockedWallets } from "./journal";
import { devCredit, getBalances, lockWallet } from "./index";
import type { Tx } from "../../db";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(() => resetDb(db));

describe("wallet locks per transaction", () => {
  it("a second lock in the same transaction returns the remembered row, kept current by postJournal", async () => {
    const owner = await createUserWithWallet(db);
    await topUp(db, owner, 500n);
    await db.transaction(async (tx) => {
      const first = await lockWallet(tx, owner);
      expect(first.balanceCents).toBe(500n);
      expect(lockedWallets(tx)?.has(owner)).toBe(true);
      await devCredit(tx, { ownerId: owner, amountCents: 250n, idempotencyKey: "credit-locks" });
      const again = await lockWallet(tx, owner);
      expect(again.balanceCents).toBe(750n);
    });
    expect(await getBalances(db, owner)).toEqual({ balanceCents: 750n, heldCents: 0n });
  });

  it("never remembers on a plain pool handle, and starts fresh in each transaction", async () => {
    const owner = await createUserWithWallet(db);
    expect(lockedWallets(db as unknown as Tx)).toBeUndefined();
    let firstTx: Map<string, unknown> | undefined;
    await db.transaction(async (tx) => {
      await lockWallet(tx, owner);
      firstTx = lockedWallets(tx);
    });
    await db.transaction(async (tx) => {
      expect(lockedWallets(tx)).not.toBe(firstTx);
      expect(lockedWallets(tx)?.has(owner)).toBe(false);
    });
  });
});
