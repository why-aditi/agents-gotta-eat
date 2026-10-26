import { describe, expect, it } from "vitest";
import { createPayoutBatch, getPayoutBatch } from "./payouts";
import { apiCalls, json, makeClient } from "./test-utils";

describe("payouts", () => {
  it("builds the batch body from cents", async () => {
    const { client, calls } = makeClient(() =>
      json(201, { batch_header: { payout_batch_id: "B1", batch_status: "PENDING" } }),
    );
    const batch = await createPayoutBatch(client, {
      senderBatchId: "w1",
      requestId: "payout:w1",
      items: [{ senderItemId: "w1", email: "a@example.com", amountCents: 1234n, note: "hi" }],
    });
    const call = apiCalls(calls)[0]!;
    expect(call.path).toBe("/v1/payments/payouts");
    expect(call.headers["PayPal-Request-Id"]).toBe("payout:w1");
    const body = JSON.parse(call.body!);
    expect(body.sender_batch_header.sender_batch_id).toBe("w1");
    expect(body.items).toEqual([
      {
        recipient_type: "EMAIL",
        receiver: "a@example.com",
        amount: { value: "12.34", currency: "USD" },
        sender_item_id: "w1",
        note: "hi",
      },
    ]);
    expect(batch).toEqual({ batchId: "B1", status: "PENDING", items: [] });
  });

  it("getPayoutBatch returns item status, errors and ids", async () => {
    const { client } = makeClient(() =>
      json(200, {
        batch_header: { payout_batch_id: "B1", batch_status: "SUCCESS" },
        items: [
          {
            payout_item_id: "I1",
            transaction_status: "UNCLAIMED",
            payout_item: { sender_item_id: "w1", amount: { value: "5.00" } },
          },
          { payout_item_id: "I2", transaction_status: "FAILED", errors: { name: "X" }, payout_item: {} },
        ],
      }),
    );
    const batch = await getPayoutBatch(client, "B1");
    expect(batch.status).toBe("SUCCESS");
    expect(batch.items[0]).toEqual({
      payoutItemId: "I1",
      senderItemId: "w1",
      status: "UNCLAIMED",
      amountCents: 500n,
      errors: null,
    });
    expect(batch.items[1]).toMatchObject({ status: "FAILED", errors: { name: "X" }, amountCents: null });
  });
});
