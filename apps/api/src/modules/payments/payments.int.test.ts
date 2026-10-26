import { ErrorBody } from "@gottaeat/schemas";
import { eq, sql } from "drizzle-orm";
import type { LightMyRequestResponse } from "fastify";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  buildTestApp,
  bountyRequest,
  createAgent,
  createMandate,
  createTestBounty,
  createTestDb,
  createUserWithWallet,
  resetDb,
  signUserToken,
  topUp,
} from "../../../test/db";
import { escrows, events, payouts, topups, users, webhookEvents } from "../../db/schema";
import { accountBalance } from "../ledger/wallets";
import { getBalances, owedCents, PLATFORM_FEES, reconcile } from "../ledger";
import { createSpendRequest, stubIntentCheck } from "../policy";
import { configurePayPal } from "../paypal";
import { apiCalls, type Call, json, makeClient } from "../paypal/test-utils";
import { pollPayouts, processWebhookEvent, registerWebhookHandler, sendPayout, setPaymentQueue } from "./index";

const { db, pool } = createTestDb();
const app = buildTestApp(db, { PAYPAL_WEBHOOK_ID: "WH-1" });

// What the stubbed PayPal answers. Tests change these.
const paypal = {
  verify: "SUCCESS" as "SUCCESS" | "FAILURE" | "ERROR",
  orderAmounts: new Map<string, string>(),
  captureStatus: "COMPLETED",
  orderCount: 0,
  payout: (): Response => json(201, { batch_header: { payout_batch_id: "BATCH-1", batch_status: "PENDING" } }),
  batchItems: [] as unknown[],
};

function handle(call: Call): Response {
  const body = call.body ? JSON.parse(call.body) : null;
  if (call.path === "/v2/checkout/orders") {
    const id = `ORD-${++paypal.orderCount}`;
    paypal.orderAmounts.set(id, body.purchase_units[0].amount.value);
    return json(201, { id, status: "CREATED" });
  }
  const capture = /^\/v2\/checkout\/orders\/(.+)\/capture$/.exec(call.path);
  if (capture) {
    const id = capture[1]!;
    return json(201, {
      id,
      status: "COMPLETED",
      purchase_units: [
        {
          payments: {
            captures: [
              {
                id: `CAP-${id}`,
                status: paypal.captureStatus,
                amount: { value: paypal.orderAmounts.get(id) ?? "0.00" },
              },
            ],
          },
        },
      ],
    });
  }
  if (call.path === "/v1/payments/payouts") return paypal.payout();
  if (call.path === "/v1/payments/payouts/BATCH-1") {
    return json(200, {
      batch_header: { payout_batch_id: "BATCH-1", batch_status: "SUCCESS" },
      items: paypal.batchItems,
    });
  }
  if (call.path === "/v1/notifications/verify-webhook-signature") {
    if (paypal.verify === "ERROR") return json(500, { name: "INTERNAL_SERVER_ERROR" });
    return json(200, { verification_status: paypal.verify });
  }
  return json(404, { name: "NOT_FOUND" });
}

const { client, calls } = makeClient(handle);
const sent = () => apiCalls(calls);

beforeEach(async () => {
  await resetDb(db);
  await db.execute(sql`truncate webhook_events`);
  Object.assign(paypal, {
    verify: "SUCCESS",
    captureStatus: "COMPLETED",
    orderCount: 0,
    payout: () => json(201, { batch_header: { payout_batch_id: "BATCH-1", batch_status: "PENDING" } }),
    batchItems: [],
  });
  paypal.orderAmounts.clear();
  calls.length = 0;
  setPaymentQueue(null);
  configurePayPal(client);
});
afterAll(async () => {
  configurePayPal(null);
  await app.close();
  await pool.end();
});

let keyCounter = 0;
const authFor = async (userId: string) =>
  `Bearer ${await signUserToken({ email: `${userId.toLowerCase()}@test.local` })}`;

async function post(userId: string, url: string, body?: unknown, key: string | null = `pay-key-${++keyCounter}`) {
  return app.inject({
    method: "POST",
    url,
    headers: { authorization: await authFor(userId), ...(key ? { "idempotency-key": key } : {}) },
    ...(body === undefined ? {} : { payload: body as Record<string, unknown> }),
  });
}

function expectError(res: LightMyRequestResponse, status: number, code: string) {
  expect(res.statusCode, res.body).toBe(status);
  expect(ErrorBody.parse(res.json()).error.code).toBe(code);
}

let eventCounter = 0;
function webhook(type: string, resource: Record<string, unknown>, id = `WH-EVT-${++eventCounter}`) {
  const payload = JSON.stringify({ id, event_type: type, resource });
  return app.inject({
    method: "POST",
    url: "/webhooks/paypal",
    headers: {
      "content-type": "application/json",
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-cert-url": "https://api.sandbox.paypal.com/cert.pem",
      "paypal-transmission-id": "tx-1",
      "paypal-transmission-sig": "sig",
      "paypal-transmission-time": "2026-10-26T00:00:00Z",
    },
    payload,
  });
}

const balance = async (userId: string) => (await getBalances(db, userId)).balanceCents;
const expectReconciled = async () => expect(await reconcile(db)).toMatchObject({ ok: true });

async function newOwner(opts: { paypalEmail?: string | null; cents?: bigint } = {}) {
  const id = await createUserWithWallet(db);
  const email = opts.paypalEmail === undefined ? "payee@personal.example.com" : opts.paypalEmail;
  await db.update(users).set({ paypalEmail: email }).where(eq(users.id, id));
  if (opts.cents) await topUp(db, id, opts.cents);
  return id;
}

describe("top-ups", () => {
  async function startTopup(owner: string, amountCents = 2500) {
    const res = await post(owner, "/v1/wallet/topups", { amountCents });
    expect(res.statusCode, res.body).toBe(201);
    return res.json() as { topupId: string; orderId: string };
  }
  // $25.00 credit + $1.42 fee.
  const capturedEvent = (topupId: string, orderId: string, value = "26.42", eventOrderId = orderId) =>
    webhook("PAYMENT.CAPTURE.COMPLETED", {
      id: `CAP-${orderId}`,
      custom_id: `topup:${topupId}`,
      amount: { currency_code: "USD", value },
      supplementary_data: { related_ids: { order_id: eventOrderId } },
    });

  it("creates a capture order for credit + fee and returns ids and amounts", async () => {
    const owner = await newOwner();
    const body = await startTopup(owner);
    expect(Object.keys(body).sort()).toEqual(["feeCents", "orderId", "topupId", "totalCents"]);
    expect(body).toMatchObject({ feeCents: 142, totalCents: 2642 });
    const [order] = sent();
    expect(order!.headers["PayPal-Request-Id"]).toBe(`topup-order:${body.topupId}`);
    const orderBody = JSON.parse(order!.body!);
    expect(orderBody.intent).toBe("CAPTURE");
    expect(orderBody.purchase_units[0]).toMatchObject({
      custom_id: `topup:${body.topupId}`,
      amount: { value: "26.42" },
    });
    const [row] = await db.select().from(topups).where(eq(topups.id, body.topupId));
    expect(row).toMatchObject({
      userId: owner,
      amountCents: 2500n,
      feeCents: 142n,
      refundedCents: 0n,
      status: "created",
      paypalOrderId: body.orderId,
    });
  });

  it("rejects amounts under $1.00, a missing key, an agent and no credentials", async () => {
    const owner = await newOwner();
    expectError(await post(owner, "/v1/wallet/topups", { amountCents: 99 }), 422, "below_minimum");
    expectError(await post(owner, "/v1/wallet/topups", { amountCents: 1_000_001 }), 400, "validation_error");
    expectError(await post(owner, "/v1/wallet/topups", { amountCents: 100 }, null), 400, "idempotency_key_required");
    const { apiKey } = await createAgent(db, owner);
    const asAgent = await app.inject({
      method: "POST",
      url: "/v1/wallet/topups",
      headers: { authorization: `Bearer ${apiKey}`, "idempotency-key": "agent-key" },
      payload: { amountCents: 500 },
    });
    expectError(asAgent, 403, "forbidden");
    configurePayPal(null);
    expectError(await post(owner, "/v1/wallet/topups", { amountCents: 500 }), 503, "paypal_not_configured");
  });

  it("confirm credits the wallet once, however often it runs", async () => {
    const owner = await newOwner();
    const { topupId } = await startTopup(owner);
    const first = await post(owner, `/v1/wallet/topups/${topupId}/confirm`);
    const again = await post(owner, `/v1/wallet/topups/${topupId}/confirm`);
    expect(first.json()).toEqual({ id: topupId, amountCents: 2500, feeCents: 142, status: "captured" });
    expect(again.statusCode).toBe(200);
    expect(await balance(owner)).toBe(2500n);
    expect(sent().filter((c) => c.path.endsWith("/capture"))).toHaveLength(1);
    expect(sent().find((c) => c.path.endsWith("/capture"))!.headers["PayPal-Request-Id"]).toBe(
      `topup-capture:${topupId}`,
    );
    const [row] = await db.select().from(topups).where(eq(topups.id, topupId));
    expect(row!.captureId).toMatch(/^CAP-/);
    await expectReconciled();
  });

  it("a webhook after confirm does not credit again", async () => {
    const owner = await newOwner();
    const { topupId, orderId } = await startTopup(owner);
    await post(owner, `/v1/wallet/topups/${topupId}/confirm`);
    expect((await capturedEvent(topupId, orderId)).statusCode).toBe(200);
    expect(await balance(owner)).toBe(2500n);
    await expectReconciled();
  });

  it("a webhook before confirm credits, and confirm then adds nothing", async () => {
    const owner = await newOwner();
    const { topupId, orderId } = await startTopup(owner);
    await capturedEvent(topupId, orderId);
    expect(await balance(owner)).toBe(2500n);
    expect((await post(owner, `/v1/wallet/topups/${topupId}/confirm`)).statusCode).toBe(200);
    expect(await balance(owner)).toBe(2500n);
    await expectReconciled();
  });

  it("confirm credits nothing while the capture is still pending", async () => {
    const owner = await newOwner();
    const { topupId } = await startTopup(owner);
    paypal.captureStatus = "PENDING";
    const res = await post(owner, `/v1/wallet/topups/${topupId}/confirm`);
    expect(res.json()).toEqual({ id: topupId, amountCents: 2500, feeCents: 142, status: "created" });
    expect(await balance(owner)).toBe(0n);
    await expectReconciled();
  });

  it("a capture for a different amount or order credits nothing", async () => {
    const owner = await newOwner();
    const { topupId, orderId } = await startTopup(owner);
    await capturedEvent(topupId, orderId, "25.00"); // the credit without the fee
    await capturedEvent(topupId, orderId, "26.42", "SOME-OTHER-ORDER");
    const events = await db.select().from(webhookEvents);
    expect(events.every((e) => e.processedAt === null && e.error?.includes("does not match"))).toBe(true);
    expect(await balance(owner)).toBe(0n);
    const [row] = await db.select().from(topups).where(eq(topups.id, topupId));
    expect(row!.status).toBe("created");
    await expectReconciled();
  });

  it("confirm is owner only", async () => {
    const owner = await newOwner();
    const other = await newOwner();
    const { topupId } = await startTopup(owner);
    expectError(await post(other, `/v1/wallet/topups/${topupId}/confirm`), 404, "not_found");
    expect(await balance(owner)).toBe(0n);
  });

  it("ignores captures that are not top-ups", async () => {
    const owner = await newOwner();
    const res = await webhook("PAYMENT.CAPTURE.COMPLETED", { id: "CAP-X", custom_id: "bty_123" });
    expect(res.statusCode).toBe(200);
    const [row] = await db.select().from(webhookEvents);
    expect(row!.processedAt).not.toBeNull();
    expect(row!.error).toBeNull();
    expect(await balance(owner)).toBe(0n);
  });
});

describe("payout email", () => {
  const url = "/v1/wallet/payout-email";
  const call = async (owner: string, method: "GET" | "PUT", payload?: unknown) =>
    app.inject({
      method,
      url,
      headers: { authorization: await authFor(owner) },
      ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
    });

  it("is null until set, then returns the lower-cased address", async () => {
    const owner = await newOwner({ paypalEmail: null });
    expect((await call(owner, "GET")).json()).toEqual({ email: null });
    const put = await call(owner, "PUT", { email: "Payee@Personal.Example.com" });
    expect(put.statusCode, put.body).toBe(200);
    expect(put.json()).toEqual({ email: "payee@personal.example.com" });
    expect((await call(owner, "GET")).json()).toEqual({ email: "payee@personal.example.com" });
  });

  it("rejects an invalid email and an agent", async () => {
    const owner = await newOwner({ paypalEmail: null });
    expectError(await call(owner, "PUT", { email: "not-an-email" }), 400, "validation_error");
    expectError(await call(owner, "PUT", {}), 400, "validation_error");
    const { apiKey } = await createAgent(db, owner);
    for (const method of ["GET", "PUT"] as const) {
      const res = await app.inject({
        method,
        url,
        headers: { authorization: `Bearer ${apiKey}` },
        ...(method === "PUT" ? { payload: { email: "a@b.example" } } : {}),
      });
      expectError(res, 403, "forbidden");
    }
    expect((await call(owner, "GET")).json()).toEqual({ email: null });
  });

  it("cannot change while a withdrawal is pending", async () => {
    const owner = await newOwner({ cents: 1000n });
    const res = await post(owner, "/v1/wallet/withdrawals", { amountCents: 500 });
    expect(res.statusCode, res.body).toBe(202);
    expectError(await call(owner, "PUT", { email: "other@personal.example.com" }), 409, "invalid_transition");
    expect((await call(owner, "GET")).json()).toEqual({ email: "payee@personal.example.com" });
    await db.update(payouts).set({ status: "succeeded" });
    expect((await call(owner, "PUT", { email: "other@personal.example.com" })).statusCode).toBe(200);
  });

  it("a withdrawal fails with no_paypal_email before it is set and works after", async () => {
    const owner = await newOwner({ paypalEmail: null, cents: 1000n });
    expectError(await post(owner, "/v1/wallet/withdrawals", { amountCents: 500 }), 409, "no_paypal_email");
    await call(owner, "PUT", { email: "New@Personal.example.com" });
    expect((await post(owner, "/v1/wallet/withdrawals", { amountCents: 500 })).statusCode).toBe(202);
    expect(JSON.parse(sent()[0]!.body!).items[0].receiver).toBe("new@personal.example.com");
  });
});

describe("withdrawals", () => {
  async function withdraw(owner: string, amountCents = 1000) {
    const res = await post(owner, "/v1/wallet/withdrawals", { amountCents });
    expect(res.statusCode, res.body).toBe(202);
    return res.json() as { id: string; status: string; amountCents: number };
  }
  const item = (payoutId: string, extra: Record<string, unknown> = {}) => ({
    payout_item_id: "ITEM-1",
    sender_item_id: payoutId,
    payout_batch_id: "BATCH-1",
    ...extra,
  });
  const itemEvent = (type: string, payoutId: string, id?: string) =>
    webhook(`PAYMENT.PAYOUTS-ITEM.${type}`, item(payoutId), id);
  const statusOf = async (id: string) => (await db.select().from(payouts).where(eq(payouts.id, id)))[0]!.status;

  it("rejects below the minimum, without a PayPal email, and without funds", async () => {
    const owner = await newOwner({ cents: 1000n });
    expectError(await post(owner, "/v1/wallet/withdrawals", { amountCents: 499 }), 422, "below_minimum");
    const noEmail = await newOwner({ paypalEmail: null, cents: 1000n });
    expectError(await post(noEmail, "/v1/wallet/withdrawals", { amountCents: 500 }), 409, "no_paypal_email");
    expectError(await post(owner, "/v1/wallet/withdrawals", { amountCents: 1001 }), 409, "insufficient_funds");
    expectError(
      await post(owner, "/v1/wallet/withdrawals", { amountCents: 500 }, null),
      400,
      "idempotency_key_required",
    );
    expect(await db.select().from(payouts)).toHaveLength(0);
    expect(await balance(owner)).toBe(1000n);
    expect(sent()).toHaveLength(0);
  });

  it("holds the amount and sends one batch with a stable request id", async () => {
    const owner = await newOwner({ cents: 1500n });
    const payout = await withdraw(owner, 1000);
    expect(payout).toMatchObject({ status: "pending", amountCents: 1000 });
    expect(await balance(owner)).toBe(500n);
    const [call] = sent();
    expect(call!.path).toBe("/v1/payments/payouts");
    expect(call!.headers["PayPal-Request-Id"]).toBe(`payout:${payout.id}`);
    const body = JSON.parse(call!.body!);
    expect(body.sender_batch_header.sender_batch_id).toBe(payout.id);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      sender_item_id: payout.id,
      receiver: "payee@personal.example.com",
      amount: { value: "10.00", currency: "USD" },
    });
    const [row] = await db.select().from(payouts);
    expect(row).toMatchObject({ paypalBatchId: "BATCH-1", status: "pending", refType: "withdrawal" });

    const list = await app.inject({
      method: "GET",
      url: "/v1/wallet/withdrawals",
      headers: { authorization: await authFor(owner) },
    });
    expect(list.json().payouts).toHaveLength(1);
    await expectReconciled();
  });

  it("a retried send reuses the request id and never sends twice", async () => {
    const owner = await newOwner({ cents: 1000n });
    const payout = await withdraw(owner, 1000);
    await sendPayout(db, payout.id);
    // A worker that died after PayPal accepted the batch but before we stored its id sends again.
    await db.update(payouts).set({ paypalBatchId: null }).where(eq(payouts.id, payout.id));
    await sendPayout(db, payout.id);
    const ids = sent().map((c) => c.headers["PayPal-Request-Id"]);
    expect(ids).toEqual([`payout:${payout.id}`, `payout:${payout.id}`]);
    expect(await balance(owner)).toBe(0n);
  });

  it("a send that PayPal rejects fails the payout and returns the hold", async () => {
    paypal.payout = () => json(400, { name: "INVALID_REQUEST", details: [{ issue: "BAD_RECEIVER" }] });
    const owner = await newOwner({ cents: 1000n });
    const payout = await withdraw(owner, 1000);
    expect(await statusOf(payout.id)).toBe("failed");
    expect(await balance(owner)).toBe(1000n);
    await expectReconciled();
  });

  it("a duplicate batch error keeps the hold: the money may already have left", async () => {
    paypal.payout = () => json(400, { name: "USER_BUSINESS_ERROR", details: [{ issue: "DUPLICATE_BATCH_ID" }] });
    const owner = await newOwner({ cents: 1000n });
    const payout = await withdraw(owner, 1000);
    expect(await statusOf(payout.id)).toBe("pending");
    expect(await balance(owner)).toBe(0n);
    await expectReconciled();
  });

  it("a PayPal outage leaves the payout pending and the hold in place", async () => {
    paypal.payout = () => json(503, { name: "SERVICE_UNAVAILABLE" });
    const owner = await newOwner({ cents: 1000n });
    const payout = await withdraw(owner, 1000);
    expect(await statusOf(payout.id)).toBe("pending");
    expect(await balance(owner)).toBe(0n);
  });

  it("ITEM.SUCCEEDED settles the hold", async () => {
    const owner = await newOwner({ cents: 1000n });
    const payout = await withdraw(owner, 1000);
    expect((await itemEvent("SUCCEEDED", payout.id)).statusCode).toBe(200);
    expect(await statusOf(payout.id)).toBe("succeeded");
    expect(await balance(owner)).toBe(0n);
    await expectReconciled();
  });

  it.each(["FAILED", "RETURNED", "CANCELED"])("ITEM.%s returns the hold", async (type) => {
    const owner = await newOwner({ cents: 1000n });
    const payout = await withdraw(owner, 1000);
    await itemEvent(type, payout.id);
    expect(await statusOf(payout.id)).toBe(type.toLowerCase());
    expect(await balance(owner)).toBe(1000n);
    await expectReconciled();
  });

  it("UNCLAIMED keeps the hold, then RETURNED returns it", async () => {
    const owner = await newOwner({ cents: 1000n });
    const payout = await withdraw(owner, 1000);
    await itemEvent("UNCLAIMED", payout.id);
    expect(await statusOf(payout.id)).toBe("unclaimed");
    expect(await balance(owner)).toBe(0n);
    await itemEvent("RETURNED", payout.id);
    expect(await statusOf(payout.id)).toBe("returned");
    expect(await balance(owner)).toBe(1000n);
    await expectReconciled();
  });

  it("UNCLAIMED then SUCCEEDED settles", async () => {
    const owner = await newOwner({ cents: 1000n });
    const payout = await withdraw(owner, 1000);
    await itemEvent("UNCLAIMED", payout.id);
    await itemEvent("SUCCEEDED", payout.id);
    expect(await statusOf(payout.id)).toBe("succeeded");
    expect(await balance(owner)).toBe(0n);
    await expectReconciled();
  });

  it("replayed and out-of-order events post once, and terminal states never change", async () => {
    const owner = await newOwner({ cents: 1000n });
    const payout = await withdraw(owner, 1000);
    await itemEvent("SUCCEEDED", payout.id, "EVT-A");
    await itemEvent("SUCCEEDED", payout.id, "EVT-A");
    await itemEvent("UNCLAIMED", payout.id, "EVT-B"); // late
    await itemEvent("RETURNED", payout.id, "EVT-C"); // contradicts the terminal state
    await itemEvent("SUCCEEDED", payout.id, "EVT-D"); // a different event id, same outcome
    expect(await statusOf(payout.id)).toBe("succeeded");
    expect(await balance(owner)).toBe(0n);
    expect(await db.select().from(webhookEvents)).toHaveLength(4);
    await expectReconciled();

    // The other way round: returned first, then a stray SUCCEEDED.
    const second = await withdraw(await newOwner({ cents: 600n }), 600);
    await itemEvent("RETURNED", second.id);
    await itemEvent("SUCCEEDED", second.id);
    expect(await statusOf(second.id)).toBe("returned");
    await expectReconciled();
  });

  it("finds the payout by payout_item_id when sender_item_id is absent", async () => {
    const owner = await newOwner({ cents: 1000n });
    const payout = await withdraw(owner, 1000);
    await db.update(payouts).set({ itemId: "ITEM-9" }).where(eq(payouts.id, payout.id));
    await webhook("PAYMENT.PAYOUTS-ITEM.SUCCEEDED", { payout_item_id: "ITEM-9" });
    expect(await statusOf(payout.id)).toBe("succeeded");
  });

  it("logs the batch event only", async () => {
    const owner = await newOwner({ cents: 1000n });
    const payout = await withdraw(owner, 1000);
    await webhook("PAYMENT.PAYOUTSBATCH.SUCCESS", { batch_header: { payout_batch_id: "BATCH-1" } });
    expect(await statusOf(payout.id)).toBe("pending");
    expect(await balance(owner)).toBe(0n);
  });

  describe("payout.poll", () => {
    const age = (id: string, minutes: number) =>
      db
        .update(payouts)
        .set({ createdAt: new Date(Date.now() - minutes * 60_000) })
        .where(eq(payouts.id, id));

    it("applies batch results to payouts older than 5 minutes", async () => {
      const owner = await newOwner({ cents: 2000n });
      const old = await withdraw(owner, 1000);
      const fresh = await withdraw(owner, 1000);
      await age(old.id, 10);
      paypal.batchItems = [
        { payout_item_id: "ITEM-1", transaction_status: "SUCCESS", payout_item: { sender_item_id: old.id } },
        { payout_item_id: "ITEM-2", transaction_status: "SUCCESS", payout_item: { sender_item_id: fresh.id } },
      ];
      expect(await pollPayouts(db, new Date())).toBe(1);
      expect(await statusOf(old.id)).toBe("succeeded");
      expect(await statusOf(fresh.id)).toBe("pending");
      await expectReconciled();
    });

    it("moves a payout through UNCLAIMED to RETURNED", async () => {
      const owner = await newOwner({ cents: 1000n });
      const payout = await withdraw(owner, 1000);
      await age(payout.id, 10);
      const result = (status: string) => [{ transaction_status: status, payout_item: { sender_item_id: payout.id } }];
      paypal.batchItems = result("UNCLAIMED");
      await pollPayouts(db, new Date());
      expect(await statusOf(payout.id)).toBe("unclaimed");
      paypal.batchItems = result("RETURNED");
      await pollPayouts(db, new Date());
      expect(await statusOf(payout.id)).toBe("returned");
      expect(await balance(owner)).toBe(1000n);
      await expectReconciled();
    });

    it("sends a payout that never reached PayPal", async () => {
      paypal.payout = () => json(503, { name: "SERVICE_UNAVAILABLE" });
      const owner = await newOwner({ cents: 1000n });
      const payout = await withdraw(owner, 1000);
      await age(payout.id, 10);
      paypal.payout = () => json(201, { batch_header: { payout_batch_id: "BATCH-1", batch_status: "PENDING" } });
      await pollPayouts(db, new Date());
      const [row] = await db.select().from(payouts);
      expect(row!.paypalBatchId).toBe("BATCH-1");
    });
  });
});

describe("POST /webhooks/paypal", () => {
  const rows = () => db.select().from(webhookEvents);

  it("rejects an unverified event with 400 and stores nothing", async () => {
    paypal.verify = "FAILURE";
    expectError(await webhook("PAYMENT.CAPTURE.COMPLETED", {}), 400, "validation_error");
    expect(await rows()).toHaveLength(0);
  });

  it("rejects an event without PayPal signature headers", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/paypal",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ id: "E1", event_type: "X", resource: {} }),
    });
    expectError(res, 400, "validation_error");
    expect(await rows()).toHaveLength(0);
  });

  it("answers 502 when the verification call fails, so PayPal redelivers", async () => {
    paypal.verify = "ERROR";
    expectError(await webhook("PAYMENT.CAPTURE.COMPLETED", {}), 502, "paypal_error");
    expect(await rows()).toHaveLength(0);
  });

  it("answers 503 when PayPal or the webhook id is not configured", async () => {
    configurePayPal(null);
    expectError(await webhook("X", {}), 503, "paypal_not_configured");
    configurePayPal(client);
    const noId = buildTestApp(db);
    const res = await noId.inject({ method: "POST", url: "/webhooks/paypal", payload: { id: "E", event_type: "X" } });
    expectError(res, 503, "paypal_not_configured");
    await noId.close();
  });

  it("verifies the raw body it received", async () => {
    await webhook("SOME.UNKNOWN.EVENT", { a: 1 }, "RAW-1");
    const verifyCall = sent().find((c) => c.path === "/v1/notifications/verify-webhook-signature")!;
    expect(JSON.parse(verifyCall.body!)).toMatchObject({
      webhook_id: "WH-1",
      transmission_id: "tx-1",
      webhook_event: { id: "RAW-1", event_type: "SOME.UNKNOWN.EVENT" },
    });
  });

  it("stores a verified event once and a replay returns 200 without reprocessing", async () => {
    let runs = 0;
    registerWebhookHandler("TEST.COUNTED", async () => {
      runs++;
    });
    expect((await webhook("TEST.COUNTED", {}, "REPLAY-1")).statusCode).toBe(200);
    expect((await webhook("TEST.COUNTED", {}, "REPLAY-1")).statusCode).toBe(200);
    expect(runs).toBe(1);
    const [row] = await rows();
    expect(await rows()).toHaveLength(1);
    expect(row).toMatchObject({ paypalEventId: "REPLAY-1", type: "TEST.COUNTED", error: null });
    expect(row!.processedAt).not.toBeNull();
  });

  it("marks an event with no handler as processed", async () => {
    expect((await webhook("CHECKOUT.ORDER.APPROVED", { id: "ORD-1" })).statusCode).toBe(200);
    const [row] = await rows();
    expect(row!.processedAt).not.toBeNull();
    expect(row!.error).toBeNull();
  });

  it("runs every handler registered for a type and records a failure for retry", async () => {
    const ran: string[] = [];
    registerWebhookHandler("TEST.MULTI", async () => {
      throw new Error("first handler broke");
    });
    registerWebhookHandler("TEST.MULTI", async () => {
      ran.push("second");
    });
    expect((await webhook("TEST.MULTI", {}, "MULTI-1")).statusCode).toBe(200);
    expect(ran).toEqual(["second"]);
    const [row] = await rows();
    expect(row).toMatchObject({ processedAt: null, error: "first handler broke" });
    // The retry job runs the same function against the stored row.
    await expect(processWebhookEvent(db, row!.id)).rejects.toThrow("first handler broke");
    expect(ran).toEqual(["second", "second"]);
  });

  it("hands processing to the queue when one is set", async () => {
    const queued: string[] = [];
    setPaymentQueue({
      webhook: async (id) => void queued.push(id),
      payout: async () => {},
    });
    await webhook("CHECKOUT.ORDER.APPROVED", {}, "Q-1");
    const [row] = await rows();
    expect(queued).toEqual([row!.id]);
    expect(row!.processedAt).toBeNull();
  });
});

describe("refunds, reversals and denials (pm-04c)", () => {
  // $25.00 credit + $1.42 fee = $26.42 charged.
  async function capturedTopup(owner: string, amountCents = 2500) {
    const res = await post(owner, "/v1/wallet/topups", { amountCents });
    expect(res.statusCode, res.body).toBe(201);
    const { topupId } = res.json() as { topupId: string };
    expect((await post(owner, `/v1/wallet/topups/${topupId}/confirm`)).statusCode).toBe(200);
    const [row] = await db.select().from(topups).where(eq(topups.id, topupId));
    return { topupId, captureId: row!.captureId! };
  }
  const topupRow = async (id: string) => (await db.select().from(topups).where(eq(topups.id, id)))[0]!;
  const refund = (captureId: string, refundId: string, value: string) => ({
    id: refundId,
    status: "COMPLETED",
    amount: { currency_code: "USD", value },
    links: [
      { href: `https://api.sandbox.paypal.com/v2/payments/refunds/${refundId}`, rel: "self", method: "GET" },
      { href: `https://api.sandbox.paypal.com/v2/payments/captures/${captureId}`, rel: "up", method: "GET" },
    ],
  });
  const refunded = (captureId: string, refundId: string, value: string, id?: string) =>
    webhook("PAYMENT.CAPTURE.REFUNDED", refund(captureId, refundId, value), id);
  const wallet = async (owner: string) =>
    (await app.inject({ method: "GET", url: "/v1/wallet", headers: { authorization: await authFor(owner) } })).json();
  const clawbackEvents = () => db.select().from(events).where(eq(events.type, "wallet.clawback"));
  const fees = () => accountBalance(db, PLATFORM_FEES);
  const lastEvent = async () => {
    const rows = await db.select().from(webhookEvents);
    return rows.sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime() || a.id.localeCompare(b.id)).at(-1)!;
  };

  it("a full refund takes the credit from the wallet and the fee from platform:fees", async () => {
    const owner = await newOwner();
    const { topupId, captureId } = await capturedTopup(owner);
    expect(await balance(owner)).toBe(2500n);
    expect(await fees()).toBe(142n);
    expect((await refunded(captureId, "REF-1", "26.42")).statusCode).toBe(200);
    expect(await balance(owner)).toBe(0n);
    expect(await fees()).toBe(0n);
    expect(await topupRow(topupId)).toMatchObject({ status: "refunded", refundedCents: 2642n });
    expect((await wallet(owner)).owedCents).toBe(0);
    const [evt] = await clawbackEvents();
    expect(evt).toMatchObject({ scope: "owner", ownerId: owner, bountyId: null });
    expect(evt!.data).toEqual({ source: "topup", refId: topupId, title: null, amountCents: 2642, owedCents: 0 });
    await expectReconciled();
  });

  it("partial refunds add up to the charge and no further", async () => {
    const owner = await newOwner();
    const { topupId, captureId } = await capturedTopup(owner);
    await refunded(captureId, "REF-A", "10.00");
    expect(await balance(owner)).toBe(1500n);
    expect(await topupRow(topupId)).toMatchObject({ status: "captured", refundedCents: 1000n });
    await refunded(captureId, "REF-B", "16.00"); // 1500 credit part + 100 fee part
    expect(await balance(owner)).toBe(0n);
    expect(await fees()).toBe(42n);
    await refunded(captureId, "REF-C", "5.00"); // only 0.42 left to take
    expect(await fees()).toBe(0n);
    expect(await topupRow(topupId)).toMatchObject({ status: "refunded", refundedCents: 2642n });
    await refunded(captureId, "REF-D", "1.00"); // nothing left
    expect(await topupRow(topupId)).toMatchObject({ refundedCents: 2642n });
    expect((await lastEvent()).error).toBeNull();
    expect(await clawbackEvents()).toHaveLength(3);
    await expectReconciled();
  });

  it("replayed events and repeated refund ids move nothing twice", async () => {
    const owner = await newOwner();
    const { topupId, captureId } = await capturedTopup(owner);
    await refunded(captureId, "REF-1", "10.00", "EVT-1");
    await refunded(captureId, "REF-1", "10.00", "EVT-1");
    await refunded(captureId, "REF-1", "10.00", "EVT-2");
    expect(await balance(owner)).toBe(1500n);
    expect(await topupRow(topupId)).toMatchObject({ refundedCents: 1000n });
    expect(await clawbackEvents()).toHaveLength(1);
    await expectReconciled();
  });

  it("a reversal beyond the balance freezes the owner until a top-up repays it", async () => {
    const owner = await newOwner();
    const { topupId, captureId } = await capturedTopup(owner);
    // The owner moves most of it out: a $20.00 withdrawal is held.
    expect((await post(owner, "/v1/wallet/withdrawals", { amountCents: 2000 })).statusCode).toBe(202);
    const { agentId } = await createAgent(db, owner);
    await createMandate(db, { agentId, createdBy: owner });
    const payeeOwner = await newOwner();
    const { agentId: payeeAgentId } = await createAgent(db, payeeOwner);
    const draft = await createTestBounty(db, { posterId: owner, status: "draft", escrow: false });

    // Defensive parsing: a negative value, and capture_id instead of links.
    const res = await webhook("PAYMENT.CAPTURE.REVERSED", {
      id: "REV-1",
      status: "COMPLETED",
      amount: { currency_code: "USD", value: "-26.42" },
      capture_id: captureId,
    });
    expect(res.statusCode).toBe(200);
    expect((await lastEvent()).error).toBeNull();
    expect(await getBalances(db, owner)).toEqual({ balanceCents: 0n, heldCents: 0n });
    expect(await owedCents(db, owner)).toBe(2000n);
    expect(await topupRow(topupId)).toMatchObject({ status: "refunded", refundedCents: 2642n });
    expect(await wallet(owner)).toMatchObject({ balanceCents: 0, owedCents: 2000 });
    expect((await clawbackEvents())[0]!.data).toMatchObject({ amountCents: 2642, owedCents: 2000 });
    await expectReconciled();

    // Frozen: no spends, withdrawals, new bounties or funding. Top-ups still work.
    const spend = await createSpendRequest(
      db,
      { type: "agent", agentId, ownerId: owner },
      { amountCents: 100, category: "tool", reason: "API credits", payeeAgentId },
      { intentCheck: stubIntentCheck("allow") },
    );
    expect(spend).toMatchObject({ decision: "deny" });
    expect(spend.reasons).toContain("account_frozen");
    expectError(await post(owner, "/v1/wallet/withdrawals", { amountCents: 500 }), 409, "account_frozen");
    expectError(await post(owner, "/v1/bounties", bountyRequest("creative_writing")), 409, "account_frozen");
    expectError(await post(owner, `/v1/bounties/${draft}/fund`), 409, "account_frozen");

    // $15.00 repays $15.00 of the $20.00: still frozen, nothing credited.
    await capturedTopup(owner, 1500);
    expect(await owedCents(db, owner)).toBe(500n);
    expect(await balance(owner)).toBe(0n);
    expectError(await post(owner, "/v1/bounties", bountyRequest("creative_writing")), 409, "account_frozen");
    // $10.00 repays the rest and credits $5.00: unfrozen.
    await capturedTopup(owner, 1000);
    expect(await owedCents(db, owner)).toBe(0n);
    expect(await wallet(owner)).toMatchObject({ balanceCents: 500, owedCents: 0 });
    expect((await post(owner, "/v1/bounties", bountyRequest("creative_writing"))).statusCode).toBe(201);
    expect((await post(owner, `/v1/bounties/${draft}/fund`)).statusCode).toBe(200);
    await expectReconciled();
  });

  it("DENIED marks a pending top-up denied, and a late COMPLETED credits nothing", async () => {
    const owner = await newOwner();
    const res = await post(owner, "/v1/wallet/topups", { amountCents: 2500 });
    const { topupId, orderId } = res.json() as { topupId: string; orderId: string };
    paypal.captureStatus = "PENDING";
    await post(owner, `/v1/wallet/topups/${topupId}/confirm`);
    await webhook("PAYMENT.CAPTURE.DENIED", {
      id: `CAP-${orderId}`,
      status: "DENIED",
      custom_id: `topup:${topupId}`,
      amount: { currency_code: "USD", value: "26.42" },
    });
    expect(await topupRow(topupId)).toMatchObject({ status: "denied", refundedCents: 0n });
    await webhook("PAYMENT.CAPTURE.COMPLETED", {
      id: `CAP-${orderId}`,
      custom_id: `topup:${topupId}`,
      amount: { currency_code: "USD", value: "26.42" },
    });
    expect(await balance(owner)).toBe(0n);
    expect(await topupRow(topupId)).toMatchObject({ status: "denied" });
    // Confirm reports it as it is and captures nothing.
    paypal.captureStatus = "COMPLETED";
    const again = await post(owner, `/v1/wallet/topups/${topupId}/confirm`);
    expect(again.json()).toMatchObject({ status: "denied" });
    expect(await balance(owner)).toBe(0n);
    await expectReconciled();
  });

  it("DENIED after a credit claws the whole charge back, once", async () => {
    const owner = await newOwner();
    const { topupId, captureId } = await capturedTopup(owner);
    const denied = { id: captureId, status: "DENIED", custom_id: `topup:${topupId}` };
    await webhook("PAYMENT.CAPTURE.DENIED", denied);
    await webhook("PAYMENT.CAPTURE.DENIED", denied);
    expect(await balance(owner)).toBe(0n);
    expect(await fees()).toBe(0n);
    expect(await topupRow(topupId)).toMatchObject({ status: "denied", refundedCents: 2642n });
    expect(await clawbackEvents()).toHaveLength(1);
    await expectReconciled();
  });

  it("a reversed bounty escrow capture puts the loss on the poster, who is frozen", async () => {
    const poster = await newOwner();
    const winner = await newOwner({ cents: 5000n }); // stands in for the reward the winner keeps
    const bountyId = await createTestBounty(db, { posterId: poster, status: "settled" });
    await db
      .update(escrows)
      .set({ status: "captured", captureId: "CAP-BTY", dev: false })
      .where(eq(escrows.bountyId, bountyId));
    await webhook("PAYMENT.CAPTURE.REVERSED", refund("CAP-BTY", "REV-B", "55.00"));
    await webhook("PAYMENT.CAPTURE.REVERSED", refund("CAP-BTY", "REV-B", "55.00"));
    expect((await lastEvent()).error).toBeNull();
    const [escrow] = await db.select().from(escrows).where(eq(escrows.bountyId, bountyId));
    expect(escrow!.status).toBe("reversed");
    expect(await owedCents(db, poster)).toBe(5500n);
    expect(await balance(winner)).toBe(5000n);
    const all = await clawbackEvents();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ ownerId: poster });
    expect(all[0]!.data).toMatchObject({ source: "bounty", refId: bountyId, amountCents: 5500, owedCents: 5500 });
    expectError(await post(poster, "/v1/bounties", bountyRequest("creative_writing")), 409, "account_frozen");
    const check = (await reconcile(db)).checks.find((c) => c.name === "receivables");
    expect(check).toMatchObject({ ok: true, detail: `1 owing: ${poster} owes 5500` });
    await expectReconciled();
  });

  it("ignores unknown captures and records an error for payloads it can't read", async () => {
    const owner = await newOwner();
    const { captureId } = await capturedTopup(owner);
    await refunded("CAP-UNKNOWN", "REF-X", "5.00", "UNK-1");
    const byId = async (id: string) =>
      (await db.select().from(webhookEvents).where(eq(webhookEvents.paypalEventId, id)))[0]!;
    let row = await byId("UNK-1");
    expect(row.processedAt).not.toBeNull();
    expect(row.error).toBeNull();

    await webhook(
      "PAYMENT.CAPTURE.REFUNDED",
      { id: "REF-Y", amount: { currency_code: "USD", value: "5.00" } },
      "BAD-1",
    );
    row = await byId("BAD-1");
    expect(row.processedAt).toBeNull();
    expect(row.error).toMatch(/names no refund or capture/);

    await webhook("PAYMENT.CAPTURE.REFUNDED", { ...refund(captureId, "REF-Z", "5.00"), amount: undefined }, "BAD-2");
    row = await byId("BAD-2");
    expect(row.processedAt).toBeNull();
    expect(row.error).toMatch(/no USD amount/);
    expect(await balance(owner)).toBe(2500n);
  });
});
