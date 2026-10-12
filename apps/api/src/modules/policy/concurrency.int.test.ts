import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createSpendFixture, createTestDb, resetDb } from "../../../test/db";
import { getBalances, reconcile } from "../ledger";
import { createSpendRequest, stubIntentCheck } from "./index";

const PARALLEL = 30;
const { db, pool } = createTestDb({ max: PARALLEL });
afterAll(() => pool.end());
beforeEach(() => resetDb(db));

describe("concurrent spend requests", () => {
  it("never pass the daily cap together", async () => {
    const f = await createSpendFixture(db, { balanceCents: 5000n, rules: { dailyMaxCents: 1000 } });

    // Check out every connection first so the requests really run at the same time.
    const clients = await Promise.all(Array.from({ length: PARALLEL }, () => pool.connect()));
    clients.forEach((c) => c.release());

    const results = await Promise.all(
      Array.from({ length: PARALLEL }, () =>
        createSpendRequest(
          db,
          f.principal,
          { payeeAgentId: f.payeeAgentId, amountCents: 100, category: "tool", reason: "credits" },
          { intentCheck: stubIntentCheck("allow") },
        ),
      ),
    );

    const settled = results.filter((r) => r.status === "settled");
    const denied = results.filter((r) => r.status === "denied");
    expect(settled).toHaveLength(10);
    expect(denied).toHaveLength(20);
    // The wallet lock serialises them, so every later request also trips the 10-per-minute limit.
    for (const d of denied) expect(d.reasons).toContain("over_daily");
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 4000n, heldCents: 0n });
    expect(await getBalances(db, f.payeeOwnerId)).toEqual({ balanceCents: 1000n, heldCents: 0n });
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("opposite tool spends between two owners don't deadlock", async () => {
    const a = await createSpendFixture(db, { balanceCents: 5000n });
    const b = await createSpendFixture(db, { balanceCents: 5000n });
    const spend = (from: typeof a, to: string) =>
      createSpendRequest(
        db,
        from.principal,
        { payeeAgentId: to, amountCents: 10, category: "tool", reason: "credits" },
        { intentCheck: stubIntentCheck("allow") },
      );
    const results = await Promise.all(
      Array.from({ length: 10 }, () => [spend(a, b.agentId), spend(b, a.agentId)]).flat(),
    );
    expect(results.every((r) => r.status === "settled")).toBe(true);
    expect(await getBalances(db, a.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });
});
