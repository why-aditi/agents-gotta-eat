import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ANSWER_KEY, at, bountyRow, dataMatching, enter, submit } from "../../../test/arena";
import {
  buildTestApp,
  createTestBounty,
  createTestDb,
  createUser,
  createUserWithWallet,
  resetDb,
  signUserToken,
} from "../../../test/db";
import { fakePayPal } from "../../../test/paypal";
import { bounties, escrows } from "../../db/schema";
import type { UserPrincipal } from "../../http/auth";
import { newId } from "../../lib/ids";
import { reconcile } from "../ledger";
import type { PayPalWebhookEvent } from "../paypal";
import {
  applyAuthorization,
  applyAuthorizationVoided,
  cancelBounty,
  confirmFunding,
  escrowWebhookHandlers,
  fundBounty,
  registerArenaHooks,
  sweepDeadlines,
} from "./index";

const { db, pool } = createTestDb();
const app = buildTestApp(db);
let paypal: ReturnType<typeof fakePayPal>;

beforeAll(() => app.ready());
beforeEach(async () => {
  await resetDb(db);
  registerArenaHooks();
  paypal = fakePayPal();
});
afterEach(() => paypal.reset());
afterAll(async () => {
  await app.close();
  await pool.end();
});

const userP = (userId: string): UserPrincipal => ({ type: "user", userId, email: `${userId}@test.local`, roles: [] });
const DAY = 86_400_000;
let eventCounter = 0;

async function draft(over: { rewardCents?: bigint; deadlineAt?: Date } = {}) {
  const posterId = await createUserWithWallet(db);
  const id = await createTestBounty(db, {
    posterId,
    status: "draft",
    deadlineAt: at(60),
    hidden: ANSWER_KEY,
    ...over,
  });
  return { id, posterId, poster: userP(posterId) };
}

async function escrowOf(bountyId: string) {
  const [row] = await db.select().from(escrows).where(eq(escrows.bountyId, bountyId));
  return row;
}

describe("fundBounty", () => {
  it("creates an AUTHORIZE order for reward + fee read from the bounty and returns only the order id", async () => {
    const { id, poster } = await draft({ rewardCents: 1234n });
    await db.update(bounties).set({ feeCents: 123n }).where(eq(bounties.id, id));
    const res = await fundBounty(db, poster, id);
    expect(res).toEqual({ orderId: "ORDER1" });
    const call = paypal.sent("/v2/checkout/orders")[0];
    expect(call?.headers["PayPal-Request-Id"]).toBe(`fund:${id}`);
    const unit = JSON.parse(call?.body ?? "{}");
    expect(unit.intent).toBe("AUTHORIZE");
    expect(unit.purchase_units[0]).toEqual({
      custom_id: id,
      amount: { currency_code: "USD", value: "13.57" },
    });
    expect(await escrowOf(id)).toMatchObject({ status: "order_created", paypalOrderId: "ORDER1", dev: false });
    expect((await bountyRow(db, id)).status).toBe("draft");
  });

  it("funding twice returns the same order without a second PayPal order", async () => {
    const { id, poster } = await draft();
    const a = await fundBounty(db, poster, id);
    const b = await fundBounty(db, poster, id);
    expect(b).toEqual(a);
    expect(paypal.sent("/v2/checkout/orders")).toHaveLength(1);
  });

  it("only the poster can fund, and only a draft", async () => {
    const { id, poster } = await draft();
    const other = userP(await createUser(db));
    await expect(fundBounty(db, other, id)).rejects.toMatchObject({ code: "not_found" });
    await db.update(bounties).set({ status: "open" }).where(eq(bounties.id, id));
    await expect(fundBounty(db, poster, id)).rejects.toMatchObject({ code: "invalid_transition" });
    expect(paypal.sent("/v2/checkout/orders")).toHaveLength(0);
  });

  it("a PayPal failure is a 502 paypal_error and stores nothing", async () => {
    const { id, poster } = await draft();
    paypal.fail.set("/v2/checkout/orders", { status: 422, issue: "INVALID_REQUEST" });
    await expect(fundBounty(db, poster, id)).rejects.toMatchObject({ code: "paypal_error", status: 502 });
    expect(await escrowOf(id)).toBeUndefined();
  });
});

describe("confirmFunding", () => {
  it("authorizes, sets honor_until = authorized_at + 3 days and opens the bounty", async () => {
    const { id, poster } = await draft();
    await fundBounty(db, poster, id);
    const now = new Date();
    const bounty = await confirmFunding(db, poster, id, now);
    expect(bounty).toMatchObject({ id, status: "open" });
    expect(paypal.sent("/v2/checkout/orders/ORDER1/authorize")[0]?.headers["PayPal-Request-Id"]).toBe(
      `authorize:${id}`,
    );
    const escrow = await escrowOf(id);
    expect(escrow).toMatchObject({ status: "authorized", authorizationId: "AUTH1", authorizedAt: now });
    expect(escrow?.honorUntil).toEqual(new Date(now.getTime() + 3 * DAY));
    expect((await bountyRow(db, id)).openedAt).toEqual(now);
  });

  it("confirming twice is idempotent", async () => {
    const { id, poster } = await draft();
    await fundBounty(db, poster, id);
    const first = await confirmFunding(db, poster, id);
    const second = await confirmFunding(db, poster, id);
    expect(second).toEqual(first);
    expect(paypal.sent("/authorize")).toHaveLength(1);
  });

  it("needs a funding order first, and the poster", async () => {
    const { id, poster } = await draft();
    await expect(confirmFunding(db, poster, id)).rejects.toMatchObject({ code: "escrow_not_authorized" });
    await fundBounty(db, poster, id);
    await expect(confirmFunding(db, userP(await createUser(db)), id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("a PayPal failure leaves the order created and the bounty a draft", async () => {
    const { id, poster } = await draft();
    await fundBounty(db, poster, id);
    paypal.fail.set("/authorize", { status: 422, issue: "ORDER_NOT_APPROVED" });
    await expect(confirmFunding(db, poster, id)).rejects.toMatchObject({ code: "paypal_error" });
    expect(await escrowOf(id)).toMatchObject({ status: "order_created", authorizationId: null });
    expect((await bountyRow(db, id)).status).toBe("draft");
  });

  it("the webhook and confirm both reaching authorized do it once", async () => {
    const { id, poster } = await draft();
    const { orderId } = await fundBounty(db, poster, id);
    const t1 = new Date();
    await applyAuthorization(db, { orderId, authorizationId: "AUTH1" }, t1);
    expect(await escrowOf(id)).toMatchObject({ status: "authorized", authorizedAt: t1 });
    expect((await bountyRow(db, id)).status).toBe("open");
    // Confirm after the webhook changes nothing and does not call PayPal again.
    await confirmFunding(db, poster, id, new Date(t1.getTime() + 5000));
    await applyAuthorization(db, { orderId, authorizationId: "AUTH9" }, new Date(t1.getTime() + 9000));
    expect(await escrowOf(id)).toMatchObject({ authorizationId: "AUTH1", authorizedAt: t1 });
    expect(paypal.sent("/authorize")).toHaveLength(0);
  });
});

describe("cancel", () => {
  it("voids the authorization of a funded bounty", async () => {
    const { id, poster } = await draft();
    await fundBounty(db, poster, id);
    await confirmFunding(db, poster, id);
    expect((await cancelBounty(db, poster, id)).status).toBe("cancelled");
    expect(paypal.sent("/authorizations/AUTH1/void")).toHaveLength(1);
    expect((await escrowOf(id))?.status).toBe("voided");
  });

  it("a failed void keeps the bounty open", async () => {
    const { id, poster } = await draft();
    await fundBounty(db, poster, id);
    await confirmFunding(db, poster, id);
    paypal.fail.set("/void", { status: 422, issue: "AUTHORIZATION_ALREADY_CAPTURED" });
    await expect(cancelBounty(db, poster, id)).rejects.toMatchObject({ code: "paypal_error" });
    expect((await bountyRow(db, id)).status).toBe("open");
    expect((await escrowOf(id))?.status).toBe("authorized");
  });

  it("a draft with an open order only abandons the escrow, with no PayPal call", async () => {
    const { id, poster } = await draft();
    await fundBounty(db, poster, id);
    await cancelBounty(db, poster, id);
    expect((await escrowOf(id))?.status).toBe("abandoned");
    expect(paypal.sent("/void")).toHaveLength(0);
    await expect(confirmFunding(db, poster, id)).rejects.toMatchObject({ code: "escrow_not_authorized" });
  });

  it("a bounty with entries still cannot be cancelled and is not voided", async () => {
    const { id, poster } = await draft();
    await fundBounty(db, poster, id);
    await confirmFunding(db, poster, id);
    await enter(db, id);
    await expect(cancelBounty(db, poster, id)).rejects.toMatchObject({ code: "bounty_has_entries" });
    expect(paypal.sent("/void")).toHaveLength(0);
  });
});

describe("a real escrow settles", () => {
  it("fund, confirm, enter, judge: captures through PayPal and reconciles clean", async () => {
    const { id, poster } = await draft();
    await fundBounty(db, poster, id);
    await confirmFunding(db, poster, id);
    const winner = await enter(db, id);
    await submit(db, winner, { data: dataMatching(5) }, 1);
    await sweepDeadlines(db, at(61));
    const call = paypal.sent("/authorizations/AUTH1/capture")[0];
    expect(call?.headers["PayPal-Request-Id"]).toBe(`capture:${id}`);
    expect(await escrowOf(id)).toMatchObject({ status: "captured", captureId: "CAP1" });
    expect((await bountyRow(db, id)).status).toBe("settled");
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("a bounty nobody passes voids the authorization", async () => {
    const { id, poster } = await draft();
    await fundBounty(db, poster, id);
    await confirmFunding(db, poster, id);
    const loser = await enter(db, id);
    await submit(db, loser, { data: dataMatching(0) }, 1);
    await sweepDeadlines(db, at(61));
    expect((await bountyRow(db, id)).status).toBe("voided");
    expect(paypal.sent("/authorizations/AUTH1/void")[0]?.headers["PayPal-Request-Id"]).toBe(`void:${id}`);
    expect((await escrowOf(id))?.status).toBe("voided");
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });

  it("a PayPal capture failure leaves the bounty judging and the ledger untouched; a retry settles", async () => {
    const { id, poster } = await draft();
    await fundBounty(db, poster, id);
    await confirmFunding(db, poster, id);
    const winner = await enter(db, id);
    await submit(db, winner, { data: dataMatching(5) }, 1);
    paypal.fail.set("/capture", { status: 422, issue: "AUTHORIZATION_VOIDED" });
    await expect(sweepDeadlines(db, at(61))).rejects.toMatchObject({ code: "paypal_error" });
    expect((await bountyRow(db, id)).settledAt).toBeNull();
    expect((await escrowOf(id))?.status).toBe("authorized");
    paypal.fail.clear();
    await sweepDeadlines(db, at(61));
    expect((await bountyRow(db, id)).status).toBe("settled");
    expect(await reconcile(db)).toMatchObject({ ok: true });
  });
});

describe("webhook handlers", () => {
  const event = (event_type: string, resource: Record<string, unknown>): PayPalWebhookEvent => ({
    id: `WH-${++eventCounter}`,
    event_type,
    resource,
  });

  it("AUTHORIZATION.CREATED authorizes by order id, and falls back to custom_id", async () => {
    const a = await draft();
    const orderA = await fundBounty(db, a.poster, a.id);
    await escrowWebhookHandlers["PAYMENT.AUTHORIZATION.CREATED"]?.(
      db,
      event("PAYMENT.AUTHORIZATION.CREATED", {
        id: "AUTHA",
        supplementary_data: { related_ids: { order_id: orderA.orderId } },
      }),
    );
    expect(await escrowOf(a.id)).toMatchObject({ status: "authorized", authorizationId: "AUTHA" });
    expect((await bountyRow(db, a.id)).status).toBe("open");

    const b = await draft();
    await fundBounty(db, b.poster, b.id);
    await escrowWebhookHandlers["PAYMENT.AUTHORIZATION.CREATED"]?.(
      db,
      event("PAYMENT.AUTHORIZATION.CREATED", { id: "AUTHB", custom_id: b.id }),
    );
    expect(await escrowOf(b.id)).toMatchObject({ status: "authorized", authorizationId: "AUTHB" });
  });

  it("unknown orders, malformed events and replays change nothing", async () => {
    const { id, poster } = await draft();
    const { orderId } = await fundBounty(db, poster, id);
    const created = escrowWebhookHandlers["PAYMENT.AUTHORIZATION.CREATED"];
    await created?.(db, event("PAYMENT.AUTHORIZATION.CREATED", { id: "AUTHX", custom_id: "bty_nope" }));
    await created?.(db, event("PAYMENT.AUTHORIZATION.CREATED", {}));
    await created?.(
      db,
      event("PAYMENT.AUTHORIZATION.CREATED", {
        id: "AUTHX",
        supplementary_data: { related_ids: { order_id: "NOPE" } },
      }),
    );
    expect(await escrowOf(id)).toMatchObject({ status: "order_created", authorizationId: null });
    const real = event("PAYMENT.AUTHORIZATION.CREATED", {
      id: "AUTH1",
      supplementary_data: { related_ids: { order_id: orderId } },
    });
    await created?.(db, real);
    const after = await escrowOf(id);
    await created?.(db, real);
    expect(await escrowOf(id)).toEqual(after);
  });

  it("AUTHORIZATION.VOIDED records a void that PayPal made for a cancelled bounty, nothing else", async () => {
    const open = await draft();
    await fundBounty(db, open.poster, open.id);
    await confirmFunding(db, open.poster, open.id);
    // Still open: a stray void event must not change the escrow.
    await escrowWebhookHandlers["PAYMENT.AUTHORIZATION.VOIDED"]?.(
      db,
      event("PAYMENT.AUTHORIZATION.VOIDED", { id: "AUTH1" }),
    );
    expect((await escrowOf(open.id))?.status).toBe("authorized");
    // Cancelled before the void was recorded (simulated): the event closes the escrow.
    await db.update(bounties).set({ status: "cancelled" }).where(eq(bounties.id, open.id));
    await applyAuthorizationVoided(db, "AUTH1");
    expect((await escrowOf(open.id))?.status).toBe("voided");
    await applyAuthorizationVoided(db, "AUTH1");
    await applyAuthorizationVoided(db, "UNKNOWN");
    expect((await escrowOf(open.id))?.status).toBe("voided");
  });

  it("capture and refund events change nothing", async () => {
    const { id, poster } = await draft();
    await fundBounty(db, poster, id);
    await confirmFunding(db, poster, id);
    const before = await escrowOf(id);
    for (const type of ["PAYMENT.CAPTURE.COMPLETED", "PAYMENT.CAPTURE.REFUNDED"]) {
      await escrowWebhookHandlers[type]?.(db, event(type, { id: "CAPX", custom_id: id }));
    }
    expect(await escrowOf(id)).toEqual(before);
  });
});

describe("routes", () => {
  const post = async (userId: string | null, url: string, key: string | null = newId("jnl")) =>
    app.inject({
      method: "POST",
      url,
      headers: {
        ...(userId
          ? { authorization: `Bearer ${await signUserToken({ email: `${userId.toLowerCase()}@test.local` })}` }
          : {}),
        ...(key ? { "idempotency-key": key } : {}),
      },
      payload: {},
    });

  it("fund returns only an order id, confirm returns the open bounty", async () => {
    const { id, posterId } = await draft();
    const fund = await post(posterId, `/v1/bounties/${id}/fund`);
    expect(fund.statusCode).toBe(200);
    expect(fund.json()).toEqual({ orderId: "ORDER1" });
    const confirm = await post(posterId, `/v1/bounties/${id}/fund/confirm`);
    expect(confirm.statusCode).toBe(200);
    expect(confirm.json()).toMatchObject({ id, status: "open" });
  });

  it("is poster only, authenticated and needs an Idempotency-Key", async () => {
    const { id, posterId } = await draft();
    const other = await createUser(db);
    expect((await post(other, `/v1/bounties/${id}/fund`)).statusCode).toBe(404);
    expect((await post(null, `/v1/bounties/${id}/fund`)).statusCode).toBe(401);
    const noKey = await post(posterId, `/v1/bounties/${id}/fund`, null);
    expect(noKey.statusCode).toBe(400);
    expect(noKey.json().error.code).toBe("idempotency_key_required");
    expect((await post(other, `/v1/bounties/${id}/fund/confirm`)).statusCode).toBe(404);
    expect((await post(posterId, `/v1/bounties/${id}/fund/confirm`, null)).statusCode).toBe(400);
    expect(paypal.sent("/v2/checkout/orders")).toHaveLength(0);
  });

  it("answers 503 paypal_not_configured without credentials", async () => {
    const { id, posterId } = await draft();
    paypal.reset();
    const res = await post(posterId, `/v1/bounties/${id}/fund`);
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe("paypal_not_configured");
  });
});
