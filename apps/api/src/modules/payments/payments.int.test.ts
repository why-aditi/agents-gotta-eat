import { ErrorBody } from "@gottaeat/schemas";
import { eq, sql } from "drizzle-orm";
import type { LightMyRequestResponse } from "fastify";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  buildTestApp,
  createAgent,
  createTestDb,
  createUserWithWallet,
  resetDb,
  signUserToken,
  topUp,
} from "../../../test/db";
import { payouts, topups, users, webhookEvents } from "../../db/schema";
import { getBalances, reconcile } from "../ledger";
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
  const capturedEvent = (topupId: string, orderId: string, value = "25.00", eventOrderId = orderId) =>
    webhook("PAYMENT.CAPTURE.COMPLETED", {
      id: `CAP-${orderId}`,
      custom_id: `topup:${topupId}`,
      amount: { currency_code: "USD", value },
      supplementary_data: { related_ids: { order_id: eventOrderId } },
    });

  it("creates a capture order and returns only ids", async () => {
    const owner = await newOwner();
    const body = await startTopup(owner);
    expect(Object.keys(body).sort()).toEqual(["orderId", "topupId"]);
    const [order] = sent();
    expect(order!.headers["PayPal-Request-Id"]).toBe(`topup-order:${body.topupId}`);
    const orderBody = JSON.parse(order!.body!);
    expect(orderBody.intent).toBe("CAPTURE");
    expect(orderBody.purchase_units[0]).toMatchObject({
      custom_id: `topup:${body.topupId}`,
      amount: { value: "25.00" },
    });
    const [row] = await db.select().from(topups).where(eq(topups.id, body.topupId));
    expect(row).toMatchObject({ userId: owner, amountCents: 2500n, status: "created", paypalOrderId: body.orderId });
  });

  it("rejects amounts under $1.00, a missing key, an agent and no credentials", async () => {
    const owner = await newOwner();
    expectError(await post(owner, "/v1/wallet/topups", { amountCents: 99 }), 422, "below_minimum");
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
    expect(first.json()).toEqual({ id: topupId, amountCents: 2500, status: "captured" });
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
    expect(res.json()).toEqual({ id: topupId, amountCents: 2500, status: "created" });
    expect(await balance(owner)).toBe(0n);
    await expectReconciled();
  });

  it("a capture for a different amount or order credits nothing", async () => {
    const owner = await newOwner();
    const { topupId, orderId } = await startTopup(owner);
    await capturedEvent(topupId, orderId, "250.00");
    await capturedEvent(topupId, orderId, "25.00", "SOME-OTHER-ORDER");
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
