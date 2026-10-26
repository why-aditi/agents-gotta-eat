import { describe, expect, it } from "vitest";
import { PayPalError } from "./errors";
import { captureAuthorization, reauthorize, voidAuthorization } from "./payments";
import { apiCalls, json, makeClient } from "./test-utils";

describe("payments", () => {
  it("captureAuthorization sends final_capture and no amount by default", async () => {
    const { client, calls } = makeClient(() => json(201, { id: "C1", status: "COMPLETED" }));
    const out = await captureAuthorization(client, "A1", undefined, "capture:b1");
    const call = apiCalls(calls)[0]!;
    expect(call.path).toBe("/v2/payments/authorizations/A1/capture");
    expect(call.headers["PayPal-Request-Id"]).toBe("capture:b1");
    expect(JSON.parse(call.body!)).toEqual({ final_capture: true });
    expect(out).toEqual({ captureId: "C1", status: "COMPLETED" });
  });

  it("captureAuthorization can send an explicit amount", async () => {
    const { client, calls } = makeClient(() => json(201, { id: "C1" }));
    await captureAuthorization(client, "A1", 4999n, "capture:b1");
    expect(JSON.parse(apiCalls(calls)[0]!.body!)).toEqual({
      final_capture: true,
      amount: { currency_code: "USD", value: "49.99" },
    });
  });

  it("reauthorize returns the new id", async () => {
    const { client } = makeClient(() =>
      json(201, { id: "A2", status: "CREATED", expiration_time: "2026-12-01T00:00:00Z" }),
    );
    expect(await reauthorize(client, "A1", "reauth:b1")).toEqual({
      id: "A2",
      status: "CREATED",
      expiresAt: "2026-12-01T00:00:00Z",
    });
  });

  it("reauthorize surfaces REAUTHORIZATION_TOO_SOON", async () => {
    const { client } = makeClient(() =>
      json(422, { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "REAUTHORIZATION_TOO_SOON" }] }),
    );
    const err = await reauthorize(client, "A1", "reauth:b1").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PayPalError);
    expect((err as PayPalError).issue).toBe("REAUTHORIZATION_TOO_SOON");
  });

  it("voidAuthorization accepts the empty 204 body", async () => {
    const { client, calls } = makeClient(() => new Response(null, { status: 204 }));
    await expect(voidAuthorization(client, "A1", "void:b1")).resolves.toBeUndefined();
    expect(apiCalls(calls)[0]!.path).toBe("/v2/payments/authorizations/A1/void");
  });
});
