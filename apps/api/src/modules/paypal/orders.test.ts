import { describe, expect, it } from "vitest";
import { authorizeOrder, captureOrder, createOrder, getOrder } from "./orders";
import { apiCalls, json, makeClient } from "./test-utils";

describe("orders", () => {
  it("createOrder sends the amount as a decimal string built from cents", async () => {
    const { client, calls } = makeClient(() => json(201, { id: "O1", status: "CREATED" }));
    const order = await createOrder(client, {
      intent: "AUTHORIZE",
      amountCents: 5500n,
      customId: "b1",
      requestId: "fund:b1",
    });
    const call = apiCalls(calls)[0]!;
    expect(call.path).toBe("/v2/checkout/orders");
    expect(call.headers["PayPal-Request-Id"]).toBe("fund:b1");
    const body = JSON.parse(call.body!);
    expect(body.intent).toBe("AUTHORIZE");
    expect(body.purchase_units[0]).toEqual({ custom_id: "b1", amount: { currency_code: "USD", value: "55.00" } });
    expect(order).toMatchObject({ id: "O1", status: "CREATED", authorizationId: null });
  });

  it("authorizeOrder returns the authorization id, expiry and cents", async () => {
    const { client, calls } = makeClient(() =>
      json(201, {
        id: "O1",
        status: "COMPLETED",
        purchase_units: [
          {
            custom_id: "b1",
            payments: { authorizations: [{ id: "A1", expiration_time: "2026-11-24T00:00:00Z" }] },
          },
        ],
      }),
    );
    const order = await authorizeOrder(client, "O1", "auth:b1");
    expect(apiCalls(calls)[0]!.path).toBe("/v2/checkout/orders/O1/authorize");
    expect(order.authorizationId).toBe("A1");
    expect(order.authorizationExpiresAt).toBe("2026-11-24T00:00:00Z");
    expect(order.customId).toBe("b1");
  });

  it("captureOrder converts the captured amount to bigint cents", async () => {
    const { client } = makeClient(() =>
      json(201, {
        id: "O2",
        status: "COMPLETED",
        purchase_units: [{ payments: { captures: [{ id: "C1", amount: { value: "10.05" } }] } }],
      }),
    );
    const order = await captureOrder(client, "O2", "topup:t1");
    expect(order.captureId).toBe("C1");
    expect(order.capturedCents).toBe(1005n);
  });

  it("getOrder is a GET", async () => {
    const { client, calls } = makeClient(() =>
      json(200, { id: "O1", status: "APPROVED", purchase_units: [{ amount: { value: "1.50" } }] }),
    );
    const order = await getOrder(client, "O1");
    expect(apiCalls(calls)[0]!.method).toBe("GET");
    expect(order.amountCents).toBe(150n);
  });
});
