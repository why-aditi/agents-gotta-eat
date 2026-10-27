// perf-01: database round-trips per spend, counted at the pg client. A budget, so a later change can't quietly
// make the hot path slower. The numbers are what the path needs today; lower is fine, higher fails.
import pg from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createSpendFixture, createTestDb, resetDb } from "../../../test/db";
import { openBounty } from "../../../test/arena";
import { enterBounty } from "../arena";
import { stubIntentCheck } from "./gate2";
import { createSpendRequest, selectIntentCheck } from "./index";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(() => resetDb(db));

// Counts every query any pg client sends while `fn` runs.
async function countQueries(fn: () => Promise<unknown>): Promise<number> {
  const proto = pg.Client.prototype as unknown as { query: (...args: unknown[]) => unknown };
  const original = proto.query;
  let n = 0;
  proto.query = function (this: unknown, ...args: unknown[]) {
    n += 1;
    return original.apply(this, args);
  };
  try {
    await fn();
  } finally {
    proto.query = original;
  }
  return n;
}

// Gate 2 as production selects it without a gateway: the ask stub, behind the reason screen. Allow, to settle.
const stub = { intentCheck: selectIntentCheck("allow", null) };
const spend = { amountCents: 100, category: "tool" as const, reason: "API credits" };

describe("spend round-trips", () => {
  it("a settled tool spend", async () => {
    const f = await createSpendFixture(db, { balanceCents: 5000n, rules: { allowedCategories: ["tool"] } });
    const n = await countQueries(() =>
      createSpendRequest(db, f.principal, { ...spend, payeeAgentId: f.payeeAgentId }, stub),
    );
    expect(n).toBeLessThanOrEqual(BUDGET.settled);
  });

  it("a denied spend", async () => {
    const f = await createSpendFixture(db, { balanceCents: 50n, rules: { allowedCategories: ["tool"] } });
    const n = await countQueries(() =>
      createSpendRequest(db, f.principal, { ...spend, payeeAgentId: f.payeeAgentId }, stub),
    );
    expect(n).toBeLessThanOrEqual(BUDGET.denied);
  });

  it("an entry stake", async () => {
    const { bountyId } = await openBounty(db, { taskType: "extract_data" });
    const f = await createSpendFixture(db, { balanceCents: 5000n, rules: { allowedCategories: ["stake"] } });
    const n = await countQueries(() =>
      enterBounty(db, f.principal, bountyId, { intentCheck: stubIntentCheck("allow") }),
    );
    expect(n).toBeLessThanOrEqual(BUDGET.stake);
  });
});

// Measured with perf-01 (before: 36, 18, 37). Test principals carry no agent name, so each spend here reads it
// once more than an authenticated request does.
const BUDGET = { settled: 25, denied: 13, stake: 33 };
