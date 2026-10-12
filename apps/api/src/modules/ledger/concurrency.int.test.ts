import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, createUserWithWallet, resetDb, topUp } from "../../../test/db";
import { getBalances, hold, LedgerError, reconcile, settle } from "./index";

const PARALLEL = 50;
const { db, pool } = createTestDb({ max: PARALLEL });
afterAll(() => pool.end());
beforeEach(() => resetDb(db));

describe("concurrent holds", () => {
  it("never overdraw a wallet", async () => {
    const a = await createUserWithWallet(db);
    await topUp(db, a, 1000n);

    // Check out every connection first so the holds really run at the same time.
    const clients = await Promise.all(Array.from({ length: PARALLEL }, () => pool.connect()));
    clients.forEach((c) => c.release());

    const results = await Promise.allSettled(
      Array.from({ length: PARALLEL }, (_, i) =>
        db.transaction((tx) =>
          hold(tx, { ownerId: a, spendRequestId: `sr_${i}`, amountCents: 100n, idempotencyKey: `hold-${i}` }),
        ),
      ),
    );

    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(ok).toHaveLength(10);
    expect(failed).toHaveLength(40);
    for (const f of failed) {
      expect(f.reason).toBeInstanceOf(LedgerError);
      expect((f.reason as LedgerError).code).toBe("INSUFFICIENT_FUNDS");
    }
    expect(await getBalances(db, a)).toEqual({ balanceCents: 0n, heldCents: 1000n });
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("settles in opposite directions at once without deadlocking", async () => {
    const a = await createUserWithWallet(db);
    const b = await createUserWithWallet(db);
    await topUp(db, a, 2000n);
    await topUp(db, b, 2000n);
    const pairs = Array.from({ length: PARALLEL / 2 }, (_, i) => [
      { from: a, to: b, sr: `sr_ab_${i}` },
      { from: b, to: a, sr: `sr_ba_${i}` },
    ]).flat();
    for (const p of pairs) {
      await db.transaction((tx) =>
        hold(tx, { ownerId: p.from, spendRequestId: p.sr, amountCents: 50n, idempotencyKey: `hold-${p.sr}` }),
      );
    }

    const clients = await Promise.all(Array.from({ length: PARALLEL }, () => pool.connect()));
    clients.forEach((c) => c.release());

    const results = await Promise.allSettled(
      pairs.map((p) =>
        db.transaction((tx) =>
          settle(tx, {
            spendRequestId: p.sr,
            payeeOwnerId: p.to,
            amountCents: 49n,
            feeCents: 1n,
            idempotencyKey: `settle-${p.sr}`,
          }),
        ),
      ),
    );

    expect(results.filter((r) => r.status === "rejected")).toEqual([]);
    // Each side paid 25 x 50 and received 25 x 49.
    expect(await getBalances(db, a)).toEqual({ balanceCents: 2000n - 1250n + 1225n, heldCents: 0n });
    expect(await getBalances(db, b)).toEqual({ balanceCents: 2000n - 1250n + 1225n, heldCents: 0n });
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });
});
