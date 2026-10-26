import { describe, expect, it } from "vitest";
import { PayPalError } from "./errors";
import { apiCalls, json, makeClient } from "./test-utils";
import { verifyWebhook } from "./webhooks";

const headers = {
  "paypal-auth-algo": "SHA256withRSA",
  "paypal-cert-url": "https://api.sandbox.paypal.com/cert",
  "paypal-transmission-id": "t1",
  "paypal-transmission-sig": "sig",
  "paypal-transmission-time": "2026-10-26T00:00:00Z",
};
const rawBody = '{"id":"WH-1","event_type":"PAYMENT.CAPTURE.COMPLETED"}';

describe("verifyWebhook", () => {
  it("is true on SUCCESS and sends the event and webhook id", async () => {
    const { client, calls } = makeClient(() => json(200, { verification_status: "SUCCESS" }));
    await expect(verifyWebhook(client, { headers, rawBody, webhookId: "WID" })).resolves.toBe(true);
    const call = apiCalls(calls)[0]!;
    expect(call.path).toBe("/v1/notifications/verify-webhook-signature");
    expect(JSON.parse(call.body!)).toEqual({
      auth_algo: "SHA256withRSA",
      cert_url: "https://api.sandbox.paypal.com/cert",
      transmission_id: "t1",
      transmission_sig: "sig",
      transmission_time: "2026-10-26T00:00:00Z",
      webhook_id: "WID",
      webhook_event: { id: "WH-1", event_type: "PAYMENT.CAPTURE.COMPLETED" },
    });
  });

  it("is false on FAILURE", async () => {
    const { client } = makeClient(() => json(200, { verification_status: "FAILURE" }));
    await expect(verifyWebhook(client, { headers, rawBody, webhookId: "WID" })).resolves.toBe(false);
  });

  it("is false, without calling PayPal, when a header is missing", async () => {
    const { client, calls } = makeClient(() => json(200, { verification_status: "SUCCESS" }));
    const partial: Record<string, string> = { ...headers };
    delete partial["paypal-transmission-sig"];
    await expect(verifyWebhook(client, { headers: partial, rawBody, webhookId: "WID" })).resolves.toBe(false);
    expect(apiCalls(calls)).toHaveLength(0);
  });

  it("is false when the body is not JSON", async () => {
    const { client } = makeClient(() => json(200, { verification_status: "SUCCESS" }));
    await expect(verifyWebhook(client, { headers, rawBody: "not json", webhookId: "WID" })).resolves.toBe(false);
  });

  it("throws, never true, on an API error", async () => {
    const { client } = makeClient(() => json(400, { name: "INVALID_REQUEST" }));
    await expect(verifyWebhook(client, { headers, rawBody, webhookId: "WID" })).rejects.toBeInstanceOf(PayPalError);
  });
});
