import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, createUserWithWallet, resetDb, topUp } from "../../../test/db";
import { newId } from "../../lib/ids";
import { getBalances, hold, LedgerError, reconcile, release, settle } from "./index";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeAll(() => resetDb(db));

const owner = fc.integer({ min: 0, max: 2 });
const cents = fc.bigInt({ min: 1n, max: 10_000n });
const op = fc.oneof(
  fc.record({ t: fc.constant("topup" as const), owner, cents }),
  fc.record({ t: fc.constant("hold" as const), owner, cents }),
  fc.record({
    t: fc.constant("settle" as const),
    pick: fc.nat(),
    payee: owner,
    feeSeed: fc.bigInt({ min: 0n, max: 10_000n }),
  }),
  fc.record({ t: fc.constant("release" as const), pick: fc.nat() }),
);

async function codeOf(p: Promise<unknown>) {
  const err = await p.then(
    () => undefined,
    (e: unknown) => e,
  );
  if (!(err instanceof LedgerError)) throw err ?? new Error("expected a LedgerError");
  return err.code;
}

describe("ledger invariants", () => {
  it("hold under random top-up, hold, settle and release sequences", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(op, { maxLength: 12 }), async (ops) => {
        // Fresh owners per run instead of truncating: reconcile still covers every run so far.
        const owners = await Promise.all([0, 1, 2].map(() => createUserWithWallet(db)));
        const balance = [0n, 0n, 0n];
        const held = [0n, 0n, 0n];
        const holds: { sr: string; owner: number; cents: bigint; open: boolean }[] = [];

        for (const o of ops) {
          const key = newId("jnl");
          if (o.t === "topup") {
            await topUp(db, owners[o.owner]!, o.cents, key);
            balance[o.owner]! += o.cents;
          } else if (o.t === "hold") {
            const sr = newId("jnl");
            const run = db.transaction((tx) =>
              hold(tx, { ownerId: owners[o.owner]!, spendRequestId: sr, amountCents: o.cents, idempotencyKey: key }),
            );
            if (balance[o.owner]! < o.cents) {
              expect(await codeOf(run)).toBe("INSUFFICIENT_FUNDS");
            } else {
              await run;
              balance[o.owner]! -= o.cents;
              held[o.owner]! += o.cents;
              holds.push({ sr, owner: o.owner, cents: o.cents, open: true });
            }
          } else {
            const h = holds[o.pick % Math.max(holds.length, 1)];
            if (!h) continue;
            const fee = o.t === "settle" ? o.feeSeed % h.cents : 0n;
            const run =
              o.t === "settle"
                ? db.transaction((tx) =>
                    settle(tx, {
                      spendRequestId: h.sr,
                      payeeOwnerId: owners[o.payee]!,
                      amountCents: h.cents - fee,
                      feeCents: fee,
                      idempotencyKey: key,
                    }),
                  )
                : db.transaction((tx) => release(tx, { spendRequestId: h.sr, idempotencyKey: key }));
            if (!h.open) {
              expect(await codeOf(run)).toBe("HOLD_NOT_OPEN");
              continue;
            }
            await run;
            h.open = false;
            held[h.owner]! -= h.cents;
            if (o.t === "settle") balance[o.payee]! += h.cents - fee;
            else balance[h.owner]! += h.cents;
          }
        }

        for (const [i, id] of owners.entries()) {
          const b = await getBalances(db, id);
          expect(b).toEqual({ balanceCents: balance[i], heldCents: held[i] });
          expect(b.balanceCents >= 0n && b.heldCents >= 0n).toBe(true);
        }
        const result = await reconcile(db);
        expect(result.checks.filter((c) => !c.ok)).toEqual([]);
      }),
      { numRuns: 1000 },
    );
  }, 600_000);
});
