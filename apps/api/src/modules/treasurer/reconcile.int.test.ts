// Ledger-vs-PayPal reconciliation against a stubbed toolkit (transaction search).
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestBounty, createTestDb, createUserWithWallet, resetDb, topUp } from "../../../test/db";
import { escrows, payouts, topups } from "../../db/schema";
import { newId } from "../../lib/ids";
import { clawbackTopup, creditTopup, holdWithdrawal, payBountyReward, settleWithdrawal } from "../ledger";
import type { PayPalToolkit, PayPalTransaction } from "../paypal";
import { clearPayPalReconcileCache, reconcilePayPal } from "./reconcile";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(async () => {
  await resetDb(db);
  clearPayPalReconcileCache();
});

const HOUR = 3_600_000;
// Journals carry the database's now(); judging "later" makes them older than the 3-hour pending window.
const later = () => new Date(Date.now() + 5 * HOUR);

function stubToolkit(transactions: Partial<PayPalTransaction>[]) {
  const calls: { start: Date; end: Date; page?: number }[] = [];
  const toolkit: PayPalToolkit = {
    mode: "toolkit",
    getOrder: async () => {
      throw new Error("not used");
    },
    listTransactions: async (args) => {
      calls.push(args);
      return {
        page: args.page ?? 1,
        totalPages: 1,
        transactions: transactions.map((t) => ({
          id: "X",
          eventCode: "T0006",
          status: "S",
          amountCents: 0n,
          customField: null,
          referenceId: null,
          initiatedAt: new Date().toISOString(),
          ...t,
        })),
      };
    },
  };
  return { toolkit, calls };
}

async function capturedTopup(ownerId: string, credit: bigint, fee: bigint, captureId: string) {
  const id = `tup_${newId("jnl").slice(4)}`;
  await db.insert(topups).values({
    id,
    userId: ownerId,
    amountCents: credit,
    feeCents: fee,
    paypalOrderId: `ORD-${captureId}`,
    captureId,
    status: "captured",
  });
  await db.transaction((tx) =>
    creditTopup(tx, { topupId: id, ownerId, cents: credit, feeCents: fee, idempotencyKey: `topup:${id}` }),
  );
  return id;
}

async function rewardedBounty(posterId: string, winnerId: string, captureId: string, dev = false) {
  const bountyId = await createTestBounty(db, { posterId, status: "settled", rewardCents: 2000n, escrow: false });
  await db.insert(escrows).values({ bountyId, status: "captured", dev, captureId: dev ? null : captureId });
  await db.transaction((tx) =>
    payBountyReward(tx, {
      bountyId,
      winnerOwnerId: winnerId,
      rewardCents: 2000n,
      feeCents: 500n,
      idempotencyKey: `reward:${bountyId}`,
    }),
  );
  return bountyId;
}

async function settledWithdrawal(ownerId: string, cents: bigint, itemId: string) {
  const id = `pay_${newId("jnl").slice(4)}`;
  await db.transaction(async (tx) => {
    await holdWithdrawal(tx, { payoutId: id, ownerId, cents, idempotencyKey: `withdrawal-hold:${id}` });
    await tx.insert(payouts).values({ id, userId: ownerId, amountCents: cents, status: "pending", itemId });
    await settleWithdrawal(tx, { payoutId: id, cents, idempotencyKey: `withdrawal-settle:${id}` });
  });
  await db.update(payouts).set({ status: "succeeded" }).where(eq(payouts.id, id));
  return id;
}

describe("reconcilePayPal", () => {
  it("matches a top-up, a bounty capture, a payout and a clawback by PayPal id and signed amount", async () => {
    const owner = await createUserWithWallet(db);
    const poster = await createUserWithWallet(db);
    const topupId = await capturedTopup(owner, 2500n, 142n, "CAP-TOPUP");
    await db.transaction((tx) =>
      clawbackTopup(tx, {
        topupId,
        ownerId: owner,
        cents: 1000n,
        creditCents: 2500n,
        feeCents: 142n,
        alreadyClawedCents: 0n,
        idempotencyKey: "clawback:REFUND-1",
      }),
    );
    await rewardedBounty(poster, owner, "CAP-BOUNTY");
    await settledWithdrawal(owner, 600n, "ITEM-1");
    // A dev credit and a dev escrow move no PayPal money: never reconciled.
    await topUp(db, owner, 999n);
    await rewardedBounty(poster, owner, "", true);

    const { toolkit } = stubToolkit([
      { id: "CAP-TOPUP", amountCents: 2642n, customField: `topup:${topupId}` },
      { id: "REFUND-1", amountCents: -1000n, eventCode: "T1107" },
      { id: "CAP-BOUNTY", amountCents: 2500n },
      { id: "ITEM-1", amountCents: -600n, eventCode: "T0000" },
    ]);
    const report = await reconcilePayPal(db, { toolkit, now: later() });
    expect(report.counts).toEqual({
      matched: 4,
      missing_in_paypal: 0,
      missing_in_ledger: 0,
      amount_mismatch: 0,
      pending: 0,
      unrelated: 0,
    });
    expect(report.ok).toBe(true);
    expect(report.cached).toBe(false);
    const byId = Object.fromEntries(report.lines.map((l) => [l.paypalId, l]));
    expect(byId["CAP-TOPUP"]).toMatchObject({ status: "matched", ledgerCents: 2642, paypalCents: 2642 });
    expect(byId["CAP-TOPUP"]!.refs).toEqual([`topup:${topupId}`]);
    expect(byId["REFUND-1"]).toMatchObject({ status: "matched", ledgerCents: -1000 });
    expect(byId["ITEM-1"]).toMatchObject({ status: "matched", ledgerCents: -600 });
    expect(report.window.days).toBe(7);
  });

  it("flags missing in PayPal, missing in the ledger (our ids only), amount mismatches, and ignores the rest", async () => {
    const owner = await createUserWithWallet(db);
    await capturedTopup(owner, 1000n, 59n, "CAP-GONE");
    await capturedTopup(owner, 1000n, 59n, "CAP-WRONG");
    const known = await capturedTopup(owner, 500n, 45n, "CAP-KNOWN");
    const { toolkit } = stubToolkit([
      { id: "CAP-WRONG", amountCents: 1000n },
      // Ours by custom id, but no journal moved it.
      { id: "CAP-STRAY", amountCents: 700n, customField: "topup:tup_STRAY" },
      // A refund of one of our captures that the ledger never saw: its id is unknown, custom id ours.
      { id: "REFUND-X", amountCents: -100n, customField: `topup:${known}` },
      { id: "CAP-KNOWN", amountCents: 545n },
      // Unrelated sandbox account activity.
      { id: "SOMEONE-ELSE", amountCents: 12345n, customField: "invoice-9" },
      { id: "BTY-STRAY", amountCents: 100n, customField: "bty_01ABCDEF" },
    ]);
    const report = await reconcilePayPal(db, { toolkit, now: later() });
    expect(report.counts).toMatchObject({
      matched: 1,
      missing_in_paypal: 1,
      missing_in_ledger: 3,
      amount_mismatch: 1,
      unrelated: 1,
    });
    expect(report.ok).toBe(false);
    const status = Object.fromEntries(report.lines.map((l) => [l.paypalId, l.status]));
    expect(status).toEqual({
      "CAP-GONE": "missing_in_paypal",
      "CAP-WRONG": "amount_mismatch",
      "CAP-STRAY": "missing_in_ledger",
      "REFUND-X": "missing_in_ledger",
      "BTY-STRAY": "missing_in_ledger",
      "CAP-KNOWN": "matched",
    });
    // Problems first.
    expect(report.lines[0]!.status).toBe("amount_mismatch");
    expect(report.lines.at(-1)!.status).toBe("matched");
  });

  it("counts a known capture id with no journal as missing in the ledger", async () => {
    const owner = await createUserWithWallet(db);
    // Captured at PayPal and recorded on the top-up, but never credited.
    await db.insert(topups).values({
      id: "tup_UNCREDITED",
      userId: owner,
      amountCents: 100n,
      paypalOrderId: "ORD",
      captureId: "CAP-UNCREDITED",
      status: "created",
    });
    const { toolkit } = stubToolkit([{ id: "CAP-UNCREDITED", amountCents: 106n }]);
    const report = await reconcilePayPal(db, { toolkit, now: later() });
    expect(report.lines).toEqual([
      expect.objectContaining({ paypalId: "CAP-UNCREDITED", status: "missing_in_ledger" }),
    ]);
  });

  it("calls a ledger movement under 3 hours old that PayPal doesn't show yet pending", async () => {
    const owner = await createUserWithWallet(db);
    await capturedTopup(owner, 1000n, 59n, "CAP-NEW");
    const { toolkit } = stubToolkit([]);
    const report = await reconcilePayPal(db, { toolkit });
    expect(report.counts.pending).toBe(1);
    expect(report.ok).toBe(true);
    expect(report.lines[0]).toMatchObject({ paypalId: "CAP-NEW", status: "pending", paypalCents: null });
  });

  it("caches for 15 minutes per window; fresh runs again", async () => {
    const { toolkit, calls } = stubToolkit([]);
    const now = new Date();
    const first = await reconcilePayPal(db, { toolkit, now });
    expect(first.cached).toBe(false);
    const second = await reconcilePayPal(db, { toolkit, now: new Date(now.getTime() + 60_000) });
    expect(second.cached).toBe(true);
    expect(second.checkedAt).toBe(first.checkedAt);
    expect(calls).toHaveLength(1);
    // Another window is cached separately.
    await reconcilePayPal(db, { toolkit, now, days: 3 });
    expect(calls).toHaveLength(2);
    const fresh = await reconcilePayPal(db, { toolkit, now: new Date(now.getTime() + 120_000), fresh: true });
    expect(fresh.cached).toBe(false);
    expect(calls).toHaveLength(3);
    // 15 minutes after the fresh run, the cache expires.
    await reconcilePayPal(db, { toolkit, now: new Date(now.getTime() + 18 * 60_000) });
    expect(calls).toHaveLength(4);
    // The search covers the window.
    expect(calls[0]!.end.getTime() - calls[0]!.start.getTime()).toBe(7 * 24 * HOUR);
  });
});
