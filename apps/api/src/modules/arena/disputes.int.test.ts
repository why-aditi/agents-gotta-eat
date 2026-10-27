import { DISPUTE_WINDOW_MS } from "@gottaeat/schemas";
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { at, bountyRow, dataMatching, enter, type Entrant, openBounty, submit } from "../../../test/arena";
import { createTestDb, createUserWithWallet, resetDb } from "../../../test/db";
import { fakePayPal } from "../../../test/paypal";
import { disputes, escrows, events, journals } from "../../db/schema";
import type { UserPrincipal } from "../../http/auth";
import { reverseEscrowCapture } from "../escrow";
import {
  disputeHoldAccount,
  disputeHoldCents,
  getBalances,
  owedCents,
  PAYPAL_CLEARING,
  PLATFORM_FEES,
  reconcile,
} from "../ledger";
import { accountBalance } from "../ledger/wallets";
import {
  getResultsFor,
  listDisputes,
  openDispute,
  pickWinner,
  registerArenaHooks,
  releaseDueDisputeHolds,
  resolveDispute,
  sweepDeadlines,
} from "./index";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
let admin: UserPrincipal;
beforeEach(async () => {
  await resetDb(db);
  registerArenaHooks();
  admin = user(await createUserWithWallet(db), ["admin"]);
});

const SETTLED = at(61);
const UNTIL = new Date(SETTLED.getTime() + DISPUTE_WINDOW_MS);
const INSIDE = new Date(UNTIL.getTime() - 60_000);
const REWARD = 5000n;

const user = (userId: string, roles: string[] = []): UserPrincipal => ({
  type: "user",
  userId,
  email: `${userId.toLowerCase()}@test.local`,
  roles,
});
const reason = { reason: "The answer key is wrong about the vendor." };

interface Settled {
  bountyId: string;
  posterId: string;
  poster: UserPrincipal;
  winner: Entrant;
  loser: Entrant;
}

// An extract_data bounty that settled at SETTLED: `winner` matched all five leaves, `loser` three (also passes).
async function settledBounty(opts: { real?: boolean } = {}): Promise<Settled> {
  const { bountyId, posterId } = await openBounty(db);
  const winner = await enter(db, bountyId);
  const loser = await enter(db, bountyId);
  await submit(db, winner, { data: dataMatching(5) }, 1);
  await submit(db, loser, { data: dataMatching(3) }, 2);
  if (opts.real) {
    await db
      .update(escrows)
      .set({ dev: false, authorizationId: "AUTH1", paypalOrderId: "ORDER1" })
      .where(eq(escrows.bountyId, bountyId));
  }
  await sweepDeadlines(db, SETTLED);
  expect((await bountyRow(db, bountyId)).status).toBe("settled");
  return { bountyId, posterId, poster: user(posterId), winner, loser };
}

const disputeEvents = (type: string) => db.select().from(events).where(eq(events.type, type));
const disputeRow = async (bountyId: string) =>
  (await db.select().from(disputes).where(eq(disputes.bountyId, bountyId)))[0];

describe("settlement", () => {
  it("an auto-judged winner's reward waits in the dispute hold for 12 hours", async () => {
    const s = await settledBounty();
    const bounty = await bountyRow(db, s.bountyId);
    expect(bounty.disputeUntil).toEqual(UNTIL);
    // The stake came back to the wallet; the reward is held, not spendable.
    expect(await getBalances(db, s.winner.ownerId)).toEqual({ balanceCents: 5000n, heldCents: REWARD });
    expect(await disputeHoldCents(db, s.bountyId)).toBe(REWARD);
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("a poster-judged bounty pays the wallet at once and has no window", async () => {
    const { bountyId, posterId } = await openBounty(db, { taskType: "creative_writing" });
    const w = await enter(db, bountyId);
    await submit(db, w, { text: "Lunch, but faster." }, 1);
    await sweepDeadlines(db, SETTLED);
    const results = await pickWinner(db, user(posterId), bountyId, w.entryId, at(62));
    expect(results).toMatchObject({ status: "settled", disputeUntil: null, dispute: null });
    expect(await getBalances(db, w.ownerId)).toEqual({ balanceCents: 5000n + REWARD, heldCents: 0n });
    expect((await bountyRow(db, bountyId)).disputeUntil).toBeNull();
    await expect(openDispute(db, user(posterId), bountyId, reason, at(63))).rejects.toMatchObject({
      code: "not_disputable",
      status: 409,
    });
  });
});

describe("openDispute", () => {
  it("opens inside the window and tells the poster and the winner's owner, without the reason", async () => {
    const s = await settledBounty();
    const d = await openDispute(db, s.poster, s.bountyId, reason, INSIDE);
    expect(d).toMatchObject({
      bountyId: s.bountyId,
      posterId: s.posterId,
      reason: reason.reason,
      status: "open",
      openedAt: INSIDE.toISOString(),
      resolvedAt: null,
      note: null,
      refundId: null,
      rewardCents: 5000,
    });
    expect(d.id).toMatch(/^dsp_/);
    const opened = await disputeEvents("dispute.opened");
    expect(opened.map((e) => e.ownerId).sort()).toEqual([s.posterId, s.winner.ownerId].sort());
    for (const e of opened) {
      expect(e.scope).toBe("owner");
      expect(e.data).toMatchObject({ disputeId: d.id, bountyId: s.bountyId, amountCents: 5000 });
      expect(JSON.stringify(e.data)).not.toContain("vendor");
    }
    // Still held.
    expect(await getBalances(db, s.winner.ownerId)).toEqual({ balanceCents: 5000n, heldCents: REWARD });
  });

  it("refuses after the window, a second dispute, a non-poster and an unsettled bounty", async () => {
    const s = await settledBounty();
    await expect(openDispute(db, s.poster, s.bountyId, reason, UNTIL)).rejects.toMatchObject({
      code: "dispute_window_closed",
      status: 409,
    });
    const stranger = user(await createUserWithWallet(db));
    await expect(openDispute(db, stranger, s.bountyId, reason, INSIDE)).rejects.toMatchObject({ code: "not_found" });
    await expect(openDispute(db, user(s.winner.ownerId), s.bountyId, reason, INSIDE)).rejects.toMatchObject({
      code: "not_found",
    });
    await openDispute(db, s.poster, s.bountyId, reason, INSIDE);
    await expect(openDispute(db, s.poster, s.bountyId, reason, INSIDE)).rejects.toMatchObject({
      code: "dispute_exists",
      status: 409,
    });
    expect(await db.select().from(disputes)).toHaveLength(1);

    const open = await openBounty(db);
    await expect(openDispute(db, user(open.posterId), open.bountyId, reason, at(5))).rejects.toMatchObject({
      code: "not_disputable",
    });
  });

  it("refuses once the hold was released", async () => {
    const s = await settledBounty();
    expect(await releaseDueDisputeHolds(db, UNTIL)).toBe(1);
    // Even if the clock disagreed, a released hold closes the window.
    await expect(openDispute(db, s.poster, s.bountyId, reason, INSIDE)).rejects.toMatchObject({
      code: "dispute_window_closed",
    });
  });
});

describe("the release sweep", () => {
  it("releases the hold to the winner's wallet once the window has passed", async () => {
    const s = await settledBounty();
    expect(await releaseDueDisputeHolds(db, INSIDE)).toBe(0);
    expect(await getBalances(db, s.winner.ownerId)).toEqual({ balanceCents: 5000n, heldCents: REWARD });
    // Through the deadline sweep.
    await sweepDeadlines(db, UNTIL);
    expect(await getBalances(db, s.winner.ownerId)).toEqual({ balanceCents: 5000n + REWARD, heldCents: 0n });
    const [release] = await db
      .select()
      .from(journals)
      .where(eq(journals.idempotencyKey, `dispute-release:${s.bountyId}`));
    expect(release?.kind).toBe("release");
    // Nothing left to release.
    expect(await releaseDueDisputeHolds(db, UNTIL)).toBe(0);
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("an open dispute blocks the release", async () => {
    const s = await settledBounty();
    await openDispute(db, s.poster, s.bountyId, reason, INSIDE);
    await sweepDeadlines(db, new Date(UNTIL.getTime() + 3_600_000));
    expect(await getBalances(db, s.winner.ownerId)).toEqual({ balanceCents: 5000n, heldCents: REWARD });
  });
});

describe("resolveDispute", () => {
  it("uphold releases the hold to the winner", async () => {
    const s = await settledBounty();
    const d = await openDispute(db, s.poster, s.bountyId, reason, INSIDE);
    const resolved = await resolveDispute(db, admin, d.id, { outcome: "uphold", note: "Key checked." }, UNTIL);
    expect(resolved).toMatchObject({ status: "upheld", resolvedAt: UNTIL.toISOString(), note: "Key checked." });
    expect((await disputeRow(s.bountyId))?.resolvedBy).toBe(admin.userId);
    expect(await getBalances(db, s.winner.ownerId)).toEqual({ balanceCents: 5000n + REWARD, heldCents: 0n });
    const ev = await disputeEvents("dispute.resolved");
    expect(ev).toHaveLength(2);
    expect(ev[0]?.data).toMatchObject({ disputeId: d.id, outcome: "upheld" });
    expect(JSON.stringify(ev.map((e) => e.data))).not.toContain("Key checked");
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("overturn on a dev escrow refunds the reward to the poster's wallet; the fee stays", async () => {
    const s = await settledBounty();
    const posterBefore = await getBalances(db, s.posterId);
    const fees = await accountBalance(db, PLATFORM_FEES);
    const d = await openDispute(db, s.poster, s.bountyId, reason, INSIDE);
    const resolved = await resolveDispute(db, admin, d.id, { outcome: "overturn" }, UNTIL);
    expect(resolved).toMatchObject({ status: "overturned", refundId: null, note: null });
    expect(await getBalances(db, s.posterId)).toEqual({
      balanceCents: posterBefore.balanceCents + REWARD,
      heldCents: 0n,
    });
    expect(await getBalances(db, s.winner.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
    expect(await accountBalance(db, PLATFORM_FEES)).toBe(fees);
    // The judge's pick stays on record.
    expect((await bountyRow(db, s.bountyId)).winnerEntryId).toBe(s.winner.entryId);
    const [refund] = await db
      .select()
      .from(journals)
      .where(eq(journals.idempotencyKey, `dispute-refund:${d.id}`));
    expect(refund?.kind).toBe("refund");
    expect((await disputeEvents("dispute.resolved"))[0]?.data).toMatchObject({ outcome: "overturned" });
    // The sweep leaves it alone afterwards.
    expect(await releaseDueDisputeHolds(db, new Date(UNTIL.getTime() + 60_000))).toBe(0);
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("resolving twice is 409 dispute_not_open; an unknown dispute is 404", async () => {
    const s = await settledBounty();
    const d = await openDispute(db, s.poster, s.bountyId, reason, INSIDE);
    await resolveDispute(db, admin, d.id, { outcome: "uphold" }, UNTIL);
    await expect(resolveDispute(db, admin, d.id, { outcome: "overturn" }, UNTIL)).rejects.toMatchObject({
      code: "dispute_not_open",
      status: 409,
    });
    await expect(resolveDispute(db, admin, "dsp_nope", { outcome: "uphold" })).rejects.toMatchObject({
      code: "not_found",
    });
    expect(await getBalances(db, s.winner.ownerId)).toEqual({ balanceCents: 5000n + REWARD, heldCents: 0n });
  });

  it("lists disputes newest first, by status", async () => {
    const a = await settledBounty();
    const b = await settledBounty();
    const da = await openDispute(db, a.poster, a.bountyId, reason, INSIDE);
    const later = await openDispute(db, b.poster, b.bountyId, reason, new Date(INSIDE.getTime() + 1000));
    await resolveDispute(db, admin, da.id, { outcome: "uphold" }, UNTIL);
    const all = await listDisputes(db);
    expect(all.map((d) => d.id)).toEqual([later.id, da.id]);
    expect((await listDisputes(db, { status: "open" })).map((d) => d.id)).toEqual([later.id]);
    expect((await listDisputes(db, { status: "upheld" }))[0]).toMatchObject({
      id: da.id,
      bountyTitle: expect.any(String),
      rewardCents: 5000,
    });
  });
});

describe("results", () => {
  it("show disputeUntil to everyone and the dispute to the poster, the winner's owner and admins", async () => {
    const s = await settledBounty();
    const d = await openDispute(db, s.poster, s.bountyId, reason, INSIDE);
    for (const viewer of [s.poster, user(s.winner.ownerId), admin]) {
      const r = await getResultsFor(db, viewer, s.bountyId);
      expect(r.disputeUntil).toBe(UNTIL.toISOString());
      expect(r.dispute).toEqual({
        id: d.id,
        status: "open",
        reason: reason.reason,
        openedAt: INSIDE.toISOString(),
        resolvedAt: null,
        note: null,
      });
    }
    for (const viewer of [user(s.loser.ownerId), s.winner.principal]) {
      const r = await getResultsFor(db, viewer, s.bountyId);
      expect(r).toMatchObject({ disputeUntil: UNTIL.toISOString(), dispute: null });
    }
  });
});

describe("real (PayPal) escrows", () => {
  let paypal: ReturnType<typeof fakePayPal>;
  beforeEach(() => {
    paypal = fakePayPal();
  });
  afterEach(() => paypal.reset());

  it("overturn refunds the reward on the capture with a stable request id; the money leaves via clearing", async () => {
    const s = await settledBounty({ real: true });
    const clearing = await accountBalance(db, PAYPAL_CLEARING);
    const posterBefore = await getBalances(db, s.posterId);
    const d = await openDispute(db, s.poster, s.bountyId, reason, INSIDE);
    const resolved = await resolveDispute(db, admin, d.id, { outcome: "overturn", note: "Key was wrong." }, UNTIL);
    expect(resolved).toMatchObject({ status: "overturned", refundId: "REFUND1" });

    const [call, ...more] = paypal.sent("/v2/payments/captures/CAP1/refund");
    expect(more).toHaveLength(0);
    expect(call?.headers["PayPal-Request-Id"]).toBe(`dispute-refund:${d.id}`);
    expect(JSON.parse(call?.body ?? "{}")).toMatchObject({ amount: { currency_code: "USD", value: "50.00" } });
    const [escrow] = await db.select().from(escrows).where(eq(escrows.bountyId, s.bountyId));
    expect(escrow).toMatchObject({ status: "captured", captureId: "CAP1", disputeRefundId: "REFUND1" });

    // accountBalance is credits - debits; clearing is an asset, so the refund's credit raises this by the reward.
    expect(await accountBalance(db, PAYPAL_CLEARING)).toBe(clearing + REWARD);
    expect(await accountBalance(db, disputeHoldAccount(s.bountyId))).toBe(0n);
    expect(await getBalances(db, s.posterId)).toEqual(posterBefore);
    expect(await getBalances(db, s.winner.ownerId)).toEqual({ balanceCents: 5000n, heldCents: 0n });
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("a failed PayPal refund rolls back: the dispute stays open and the reward held", async () => {
    const s = await settledBounty({ real: true });
    const d = await openDispute(db, s.poster, s.bountyId, reason, INSIDE);
    paypal.fail.set("/refund", { status: 422, issue: "CAPTURE_FULLY_REFUNDED" });
    await expect(resolveDispute(db, admin, d.id, { outcome: "overturn" }, UNTIL)).rejects.toMatchObject({
      code: "paypal_error",
      status: 502,
    });
    expect(await disputeRow(s.bountyId)).toMatchObject({ status: "open", refundId: null });
    expect(await disputeHoldCents(db, s.bountyId)).toBe(REWARD);
    const [escrow] = await db.select().from(escrows).where(eq(escrows.bountyId, s.bountyId));
    expect(escrow?.disputeRefundId).toBeNull();
  });

  it("the refund webhook for our own refund claws nothing back; a foreign refund still does", async () => {
    const s = await settledBounty({ real: true });
    const d = await openDispute(db, s.poster, s.bountyId, reason, INSIDE);
    await resolveDispute(db, admin, d.id, { outcome: "overturn" }, UNTIL);
    const before = await getBalances(db, s.posterId);

    const ours = await reverseEscrowCapture(db, { captureId: "CAP1", refundId: "REFUND1", cents: () => REWARD });
    expect(ours).toBe(true);
    expect(await getBalances(db, s.posterId)).toEqual(before);
    expect(await owedCents(db, s.posterId)).toBe(0n);
    expect(await db.select().from(journals).where(eq(journals.kind, "clawback"))).toHaveLength(0);
    expect(await db.select().from(events).where(eq(events.type, "wallet.clawback"))).toHaveLength(0);
    const [escrow] = await db.select().from(escrows).where(eq(escrows.bountyId, s.bountyId));
    expect(escrow?.status).toBe("captured");

    // Someone refunds the fee part from the PayPal dashboard: that one is a clawback as before.
    expect(await reverseEscrowCapture(db, { captureId: "CAP1", refundId: "REFUND-X", cents: () => 500n })).toBe(true);
    const clawbacks = await db
      .select()
      .from(journals)
      .where(and(eq(journals.kind, "clawback"), eq(journals.idempotencyKey, "clawback:REFUND-X")));
    expect(clawbacks).toHaveLength(1);
    const [after] = await db.select().from(escrows).where(eq(escrows.bountyId, s.bountyId));
    expect(after?.status).toBe("reversed");
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });
});
