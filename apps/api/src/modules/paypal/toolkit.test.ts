// The Agent Toolkit wrapper: sandbox only; a fresh toolkit (and request id) per call; a loopback base falls back to
// the typed client's direct calls. The real toolkit can't run here (no PayPal), so a fake stands in for it.
import { afterEach, describe, expect, it } from "vitest";
import type { PayPalCallRecord } from "./call-log";
import { PayPalError } from "./errors";
import { json, makeClient } from "./test-utils";
import {
  configurePayPalToolkit,
  createPayPalToolkit,
  type MakeToolkit,
  type ToolkitToolCall,
  toolkitGetOrder,
  toolkitListTransactions,
} from "./toolkit";

const SANDBOX = "https://api-m.sandbox.paypal.com";

const ORDER = {
  id: "ORDER1",
  status: "COMPLETED",
  purchase_units: [
    {
      custom_id: "topup:tup_1",
      amount: { currency_code: "USD", value: "26.42" },
      payments: { captures: [{ id: "CAP1", status: "COMPLETED", amount: { currency_code: "USD", value: "26.42" } }] },
    },
  ],
};

const SEARCH = {
  transaction_details: [
    {
      transaction_info: {
        transaction_id: "CAP1",
        transaction_event_code: "T0006",
        transaction_status: "S",
        transaction_amount: { currency_code: "USD", value: "26.42" },
        custom_field: "topup:tup_1",
        transaction_initiation_date: "2026-10-27T10:00:00+0000",
      },
    },
    {
      transaction_info: {
        transaction_id: "ITEM1",
        transaction_event_code: "T0000",
        transaction_amount: { currency_code: "USD", value: "-6.00" },
      },
    },
    { payer_info: { email_address: "no transaction_info here" } },
  ],
  total_pages: 2,
  page: 1,
};

function fakeToolkit(reply: (call: ToolkitToolCall) => unknown) {
  const made: { requestId: string; clientId: string }[] = [];
  const calls: ToolkitToolCall[] = [];
  const make: MakeToolkit = async ({ clientId, requestId }) => {
    made.push({ clientId, requestId });
    return {
      handleToolCall: async (call) => {
        calls.push(call);
        return { content: JSON.stringify(reply(call)) };
      },
    };
  };
  return { make, made, calls };
}

afterEach(() => configurePayPalToolkit(null));

describe("createPayPalToolkit", () => {
  it("refuses any base but the sandbox or a loopback fake", () => {
    const { client } = makeClient(() => json(200, {}));
    for (const apiBase of ["https://api-m.paypal.com", "https://api.paypal.com", "http://evil.example:4010"]) {
      expect(() => createPayPalToolkit({ clientId: "id", clientSecret: "s", apiBase, client })).toThrow(/sandbox only/);
    }
  });

  it("calls the toolkit's get_order and list_transactions with a fresh request id each, and logs each call", async () => {
    const { client, calls: direct } = makeClient(() => json(500, {}));
    const fake = fakeToolkit((call) => (call.function.name === "get_order" ? ORDER : SEARCH));
    const logged: PayPalCallRecord[] = [];
    const toolkit = createPayPalToolkit({
      clientId: "id",
      clientSecret: "s",
      apiBase: SANDBOX,
      client,
      makeToolkit: fake.make,
      record: (c) => {
        logged.push(c);
      },
    });
    expect(toolkit.mode).toBe("toolkit");
    configurePayPalToolkit(toolkit);

    const order = await toolkitGetOrder("ORDER1");
    expect(order).toMatchObject({ id: "ORDER1", customId: "topup:tup_1", captureId: "CAP1", capturedCents: 2642n });
    const start = new Date("2026-10-20T10:00:00.123Z");
    const end = new Date("2026-10-27T10:00:00.456Z");
    const page = await toolkitListTransactions({ start, end, page: 1 });
    expect(page.totalPages).toBe(2);
    expect(page.transactions).toEqual([
      expect.objectContaining({ id: "CAP1", amountCents: 2642n, customField: "topup:tup_1", eventCode: "T0006" }),
      expect.objectContaining({ id: "ITEM1", amountCents: -600n, customField: null }),
    ]);

    expect(fake.calls.map((c) => [c.function.name, JSON.parse(c.function.arguments)])).toEqual([
      ["get_order", { id: "ORDER1" }],
      [
        "list_transactions",
        { start_date: "2026-10-20T10:00:00Z", end_date: "2026-10-27T10:00:01Z", page_size: 500, page: 1 },
      ],
    ]);
    // A new toolkit per call, so each gets its own PayPal-Request-Id.
    expect(fake.made).toHaveLength(2);
    expect(fake.made[0]!.requestId).not.toBe(fake.made[1]!.requestId);
    expect(direct).toHaveLength(0);
    expect(logged.map((l) => [l.source, l.path, l.status, l.requestId])).toEqual([
      ["toolkit", "/v2/checkout/orders/ORDER1", 200, fake.made[0]!.requestId],
      ["toolkit", "/v1/reporting/transactions?start_date&end_date&page", 200, fake.made[1]!.requestId],
    ]);
  });

  it("turns a toolkit error into a PayPalError and logs its status", async () => {
    const { client } = makeClient(() => json(500, {}));
    const fake = fakeToolkit(() => ({
      ok: false,
      status: 403,
      code: "PAYPAL_API_HTTP_ERROR",
      message: "NOT_AUTHORIZED",
    }));
    const logged: PayPalCallRecord[] = [];
    const toolkit = createPayPalToolkit({
      clientId: "id",
      clientSecret: "s",
      apiBase: SANDBOX,
      client,
      makeToolkit: fake.make,
      record: (c) => {
        logged.push(c);
      },
    });
    const err = await toolkit.getOrder("ORDER1").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PayPalError);
    expect((err as PayPalError).status).toBe(403);
    expect((err as PayPalError).message).toContain("NOT_AUTHORIZED");
    expect(logged[0]).toMatchObject({ status: 403, source: "toolkit" });

    const thrown = createPayPalToolkit({
      clientId: "id",
      clientSecret: "s",
      apiBase: SANDBOX,
      client,
      makeToolkit: async () => {
        throw new Error("boom");
      },
    });
    await expect(thrown.listTransactions({ start: new Date(), end: new Date() })).rejects.toBeInstanceOf(PayPalError);
  });

  it("falls back to the client's direct calls for a loopback base", async () => {
    const { client, calls } = makeClient(
      (call) => {
        if (call.path === "/v2/checkout/orders/ORDER1") return json(200, ORDER);
        if (call.path === "/v1/reporting/transactions") return json(200, SEARCH);
        return json(404, {});
      },
      { apiBase: "http://localhost:4010" },
    );
    const fake = fakeToolkit(() => ORDER);
    const toolkit = createPayPalToolkit({
      clientId: "id",
      clientSecret: "s",
      apiBase: "http://localhost:4010",
      client,
      makeToolkit: fake.make,
    });
    expect(toolkit.mode).toBe("direct");
    expect((await toolkit.getOrder("ORDER1")).captureId).toBe("CAP1");
    const page = await toolkit.listTransactions({
      start: new Date("2026-10-20T00:00:00Z"),
      end: new Date("2026-10-27T00:00:00Z"),
      page: 2,
    });
    expect(page.transactions).toHaveLength(2);
    expect(fake.made).toHaveLength(0);
    const search = calls.find((c) => c.path === "/v1/reporting/transactions")!;
    const q = new URLSearchParams(search.search);
    expect(Object.fromEntries(q)).toEqual({
      start_date: "2026-10-20T00:00:00Z",
      end_date: "2026-10-27T00:00:00Z",
      transaction_status: "S",
      fields: "transaction_info",
      page_size: "500",
      page: "2",
    });
  });

  it("answers paypal_not_configured without a toolkit", async () => {
    configurePayPalToolkit(null);
    await expect(toolkitGetOrder("X")).rejects.toMatchObject({ code: "paypal_not_configured" });
  });
});
