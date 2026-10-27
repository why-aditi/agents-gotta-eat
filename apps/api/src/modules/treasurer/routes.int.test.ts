// /v1/admin/paypal/*, /v1/admin/reconcile/paypal and /v1/admin/treasurer/ask.
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp, createAgent, createTestDb, createUser, resetDb, signUserToken } from "../../../test/db";
import { webhookEvents } from "../../db/schema";
import { newId } from "../../lib/ids";
import { configurePayPal, configurePayPalToolkit, recordPayPalCall, type PayPalToolkit } from "../paypal";
import { json, makeClient } from "../paypal/test-utils";
import { clearPayPalReconcileCache } from "./reconcile";

const { db, pool } = createTestDb();
afterAll(() => pool.end());

type App = ReturnType<typeof buildTestApp>;
let app: App;
let searches = 0;

function configure() {
  const { client } = makeClient(() => json(200, {}), { apiBase: "http://localhost:4999" });
  configurePayPal(client);
  const toolkit: PayPalToolkit = {
    mode: "direct",
    getOrder: async () => {
      throw new Error("unused");
    },
    listTransactions: async ({ page }) => {
      searches += 1;
      return { page: page ?? 1, totalPages: 1, transactions: [] };
    },
  };
  configurePayPalToolkit(toolkit);
}

beforeEach(async () => {
  await resetDb(db);
  clearPayPalReconcileCache();
  searches = 0;
  configure();
  app = buildTestApp(db);
});
afterEach(async () => {
  await app.close();
  configurePayPal(null);
  configurePayPalToolkit(null);
});

async function adminToken(): Promise<string> {
  const email = `admin-${newId("usr").toLowerCase()}@test.local`;
  const token = await signUserToken({ email });
  await app.inject({ method: "GET", url: "/v1/me", headers: { authorization: `Bearer ${token}` } });
  await db.execute(sql`update users set roles = '{admin}' where email = ${email}`);
  return token;
}

const call = (method: "GET" | "POST", url: string, token?: string, body?: unknown) =>
  app.inject({
    method,
    url,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    ...(body !== undefined ? { payload: body as object } : {}),
  });

const ROUTES: ["GET" | "POST", string, unknown?][] = [
  ["GET", "/v1/admin/paypal/calls"],
  ["GET", "/v1/admin/paypal/webhooks"],
  ["POST", "/v1/admin/reconcile/paypal", {}],
  ["POST", "/v1/admin/treasurer/ask", { question: "Does the ledger match PayPal?" }],
];

describe("access", () => {
  it("401 without auth, 403 for non-admins and agent keys", async () => {
    const owner = await createUser(db);
    const { apiKey } = await createAgent(db, owner);
    const userToken = await signUserToken({ email: "plain@test.local" });
    for (const [method, url, body] of ROUTES) {
      expect((await call(method, url, undefined, body)).statusCode, url).toBe(401);
      const asUser = await call(method, url, userToken, body);
      expect(asUser.statusCode, url).toBe(403);
      expect(asUser.json().error.code).toBe("forbidden");
      expect((await call(method, url, apiKey, body)).statusCode, url).toBe(403);
    }
  });

  it("503 paypal_not_configured for the PayPal routes without PayPal; the Treasurer still answers", async () => {
    configurePayPal(null);
    configurePayPalToolkit(null);
    const token = await adminToken();
    for (const [method, url, body] of ROUTES.slice(0, 3)) {
      const res = await call(method, url, token, body);
      expect(res.statusCode, url).toBe(503);
      expect(res.json().error.code).toBe("paypal_not_configured");
    }
    const ask = await call("POST", "/v1/admin/treasurer/ask", token, { question: "Does the ledger match PayPal?" });
    expect(ask.statusCode).toBe(200);
    expect(ask.json()).toMatchObject({ fallback: true, model: null });
    expect(ask.json().answer).toContain("could not run");
  });
});

describe("GET /v1/admin/paypal/calls", () => {
  it("pages newest first, 100 at a time", async () => {
    const token = await adminToken();
    for (let i = 0; i < 103; i++) {
      await recordPayPalCall(db, {
        method: "POST",
        path: `/v2/checkout/orders/${i}`,
        status: i === 102 ? 422 : 201,
        debugId: i === 102 ? "dbg-x" : null,
        requestId: `rq-${i}`,
        durationMs: 12,
        source: i % 10 === 0 ? "toolkit" : "client",
      });
    }
    const first = await call("GET", "/v1/admin/paypal/calls", token);
    expect(first.statusCode).toBe(200);
    const page = first.json();
    expect(page.items).toHaveLength(100);
    expect(page.items[0]).toMatchObject({
      path: "/v2/checkout/orders/102",
      status: 422,
      debugId: "dbg-x",
      requestId: "rq-102",
      durationMs: 12,
      source: "client",
    });
    expect(typeof page.items[0].createdAt).toBe("string");
    const second = (await call("GET", `/v1/admin/paypal/calls?cursor=${page.nextCursor}`, token)).json();
    expect(second.items.map((c: { path: string }) => c.path)).toEqual([
      "/v2/checkout/orders/2",
      "/v2/checkout/orders/1",
      "/v2/checkout/orders/0",
    ]);
    expect(second.items[2].source).toBe("toolkit");
    expect(second.nextCursor).toBeNull();
    expect((await call("GET", "/v1/admin/paypal/calls?cursor=abc", token)).statusCode).toBe(400);
  });
});

describe("GET /v1/admin/paypal/webhooks", () => {
  it("lists events newest first without payloads, with a cursor", async () => {
    const token = await adminToken();
    const base = Date.now() - 1_000_000;
    await db.insert(webhookEvents).values(
      Array.from({ length: 102 }, (_, i) => ({
        id: `whe_${String(i).padStart(3, "0")}`,
        paypalEventId: `WH-${i}`,
        type: i % 2 ? "PAYMENT.CAPTURE.COMPLETED" : "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
        payload: { id: `WH-${i}`, resource: { note: "SECRET-PAYLOAD", payer: { email: "buyer@example.com" } } },
        receivedAt: new Date(base + i * 1000),
        processedAt: i === 101 ? null : new Date(base + i * 1000 + 50),
        error: i === 101 ? "capture does not match" : null,
      })),
    );
    const first = await call("GET", "/v1/admin/paypal/webhooks", token);
    expect(first.statusCode).toBe(200);
    const page = first.json();
    expect(page.items).toHaveLength(100);
    expect(page.items[0]).toEqual({
      id: "whe_101",
      paypalEventId: "WH-101",
      type: "PAYMENT.CAPTURE.COMPLETED",
      receivedAt: new Date(base + 101_000).toISOString(),
      processedAt: null,
      error: "capture does not match",
    });
    expect(first.body).not.toContain("SECRET-PAYLOAD");
    expect(first.body).not.toContain("buyer@example.com");
    expect(first.body).not.toContain("payload");
    const second = (await call("GET", `/v1/admin/paypal/webhooks?cursor=${page.nextCursor}`, token)).json();
    expect(second.items.map((e: { id: string }) => e.id)).toEqual(["whe_001", "whe_000"]);
    expect(second.nextCursor).toBeNull();
    expect((await call("GET", "/v1/admin/paypal/webhooks?cursor=bad!", token)).statusCode).toBe(400);
  });
});

describe("POST /v1/admin/reconcile/paypal", () => {
  it("runs, returns the cached report, and runs again with fresh=true", async () => {
    const token = await adminToken();
    const first = await call("POST", "/v1/admin/reconcile/paypal", token, { days: 3 });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ ok: true, cached: false, window: { days: 3 }, lines: [] });
    expect(first.json().counts).toEqual({
      matched: 0,
      missing_in_paypal: 0,
      missing_in_ledger: 0,
      amount_mismatch: 0,
      pending: 0,
      unrelated: 0,
    });
    const second = await call("POST", "/v1/admin/reconcile/paypal", token, { days: 3 });
    expect(second.json().cached).toBe(true);
    const fresh = await call("POST", "/v1/admin/reconcile/paypal?fresh=true", token, { days: 3 });
    expect(fresh.json().cached).toBe(false);
    expect(searches).toBe(2);
    // Defaults to 7 days; at most 31.
    expect((await call("POST", "/v1/admin/reconcile/paypal", token, {})).json().window.days).toBe(7);
    expect((await call("POST", "/v1/admin/reconcile/paypal", token, { days: 32 })).statusCode).toBe(400);
  });

  it("a PayPal failure is a 502, not a report", async () => {
    configurePayPalToolkit({
      mode: "direct",
      getOrder: async () => ({}) as never,
      listTransactions: async () => {
        throw new Error("PayPal down");
      },
    });
    const token = await adminToken();
    const res = await call("POST", "/v1/admin/reconcile/paypal", token, {});
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe("paypal_error");
  });
});

describe("POST /v1/admin/treasurer/ask", () => {
  it("validates the question and rate-limits to 10 a minute per admin", async () => {
    const token = await adminToken();
    expect((await call("POST", "/v1/admin/treasurer/ask", token, { question: "" })).statusCode).toBe(400);
    expect((await call("POST", "/v1/admin/treasurer/ask", token, { question: "x".repeat(501) })).statusCode).toBe(400);
    const answers = [];
    // Rejected (400) questions never reach the limiter.
    for (let i = 0; i < 10; i++) {
      answers.push(await call("POST", "/v1/admin/treasurer/ask", token, { question: "Does the ledger match PayPal?" }));
    }
    expect(answers.every((a) => a.statusCode === 200)).toBe(true);
    expect(answers[0]!.json()).toMatchObject({ fallback: true, model: null, cited: [] });
    const limited = await call("POST", "/v1/admin/treasurer/ask", token, { question: "One more?" });
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error.code).toBe("rate_limited");
    // Another admin has their own allowance.
    const other = await adminToken();
    expect((await call("POST", "/v1/admin/treasurer/ask", other, { question: "Hello?" })).statusCode).toBe(200);
  });
});
