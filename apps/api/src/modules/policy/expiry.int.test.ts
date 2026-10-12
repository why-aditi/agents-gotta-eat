import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createSpendFixture, createTestDb, resetDb } from "../../../test/db";
import { getBalances, reconcile } from "../ledger";
import { createSpendRequest, getSpendRequestFor, releaseExpired, startExpirySweep, stubIntentCheck } from "./index";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(() => resetDb(db));

const T0 = new Date("2026-10-12T10:00:00.000Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

describe("releaseExpired", () => {
  it("releases only overdue pending_approval requests", async () => {
    const f = await createSpendFixture(db, { balanceCents: 5000n, rules: { askAboveCents: 150 } });
    const owner = { type: "user" as const, userId: f.ownerId, email: "o@test.local", roles: [] };
    const spend = (amountCents: number, category: "tool" | "subcontract", minutes: number) =>
      createSpendRequest(
        db,
        f.principal,
        { payeeAgentId: f.payeeAgentId, amountCents, category, reason: "x" },
        { intentCheck: stubIntentCheck("allow"), now: () => at(minutes) },
      );

    const first = await spend(200, "tool", 0); // pending, expires at +15
    const second = await spend(300, "tool", 10); // pending, expires at +25
    const allowed = await spend(100, "subcontract", 0); // allowed, holds 102
    const settled = await spend(100, "tool", 0);
    expect([first.status, second.status, allowed.status, settled.status]).toEqual([
      "pending_approval",
      "pending_approval",
      "allowed",
      "settled",
    ]);

    expect(await releaseExpired(db, at(14))).toBe(0);
    expect(await releaseExpired(db, at(16))).toBe(1);
    expect((await getSpendRequestFor(db, owner, first.id, at(16))).status).toBe("released");
    expect((await getSpendRequestFor(db, owner, second.id, at(16))).status).toBe("pending_approval");
    expect((await getSpendRequestFor(db, owner, allowed.id, at(16))).status).toBe("allowed");
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n - 300n - 102n - 100n, heldCents: 402n });
    expect(await reconcile(db)).toMatchObject({ ok: true });

    expect(await releaseExpired(db, at(26))).toBe(1);
    expect(await releaseExpired(db, at(60))).toBe(0);
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n - 102n - 100n, heldCents: 102n });
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("a read releases an overdue request", async () => {
    const f = await createSpendFixture(db, { balanceCents: 5000n });
    const res = await createSpendRequest(
      db,
      f.principal,
      { payeeAgentId: f.payeeAgentId, amountCents: 100, category: "tool", reason: "x" },
      { intentCheck: stubIntentCheck("ask"), now: () => T0 },
    );
    const sr = await getSpendRequestFor(db, f.principal, res.id, at(15));
    expect(sr.status).toBe("released");
    expect(await getBalances(db, f.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
  });

  it("the sweep releases overdue requests until stopped", async () => {
    const f = await createSpendFixture(db, { balanceCents: 5000n });
    const res = await createSpendRequest(
      db,
      f.principal,
      { payeeAgentId: f.payeeAgentId, amountCents: 100, category: "tool", reason: "x" },
      { intentCheck: stubIntentCheck("ask"), now: () => new Date(Date.now() - 16 * 60_000) },
    );
    const errors: unknown[] = [];
    const stop = startExpirySweep(db, 20, (err) => errors.push(err));
    try {
      await expect
        .poll(async () => (await getBalances(db, f.ownerId)).heldCents, { timeout: 5000, interval: 25 })
        .toBe(0n);
    } finally {
      stop();
    }
    expect(errors).toEqual([]);
    expect((await getSpendRequestFor(db, f.principal, res.id)).status).toBe("released");
  });
});
