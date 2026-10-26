import { describe, expect, it } from "vitest";
import { createPayPalClient } from "./client";
import { PayPalError } from "./errors";
import { apiCalls, json, makeClient } from "./test-utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("headers", () => {
  it("sends Bearer auth, JSON body and a UUID request id that differs per call", async () => {
    const { client, calls } = makeClient(() => json(200, { ok: true }));
    await client.request({ method: "POST", path: "/x", body: { a: 1 } });
    await client.request({ method: "POST", path: "/x", body: { a: 1 } });
    const [a, b] = apiCalls(calls);
    expect(a!.headers.Authorization).toBe("Bearer tok");
    expect(a!.headers["Content-Type"]).toBe("application/json");
    expect(a!.body).toBe('{"a":1}');
    expect(a!.headers["PayPal-Request-Id"]).toMatch(UUID);
    expect(b!.headers["PayPal-Request-Id"]).toMatch(UUID);
    expect(a!.headers["PayPal-Request-Id"]).not.toBe(b!.headers["PayPal-Request-Id"]);
  });

  it("uses the caller-supplied request id", async () => {
    const { client, calls } = makeClient(() => json(200, {}));
    await client.request({ method: "POST", path: "/x", requestId: "capture:b1" });
    expect(apiCalls(calls)[0]!.headers["PayPal-Request-Id"]).toBe("capture:b1");
  });
});

describe("token", () => {
  it("is fetched once for two calls", async () => {
    const { client, calls } = makeClient(() => json(200, {}));
    await client.request({ method: "GET", path: "/a" });
    await client.request({ method: "GET", path: "/b" });
    expect(calls.filter((c) => c.path === "/v1/oauth2/token")).toHaveLength(1);
  });

  it("is refreshed 60s before expiry", async () => {
    let t = 0;
    const { client, calls } = makeClient(() => json(200, {}), { now: () => t });
    await client.request({ method: "GET", path: "/a" });
    t = 32400_000 - 61_000;
    await client.request({ method: "GET", path: "/a" });
    expect(calls.filter((c) => c.path === "/v1/oauth2/token")).toHaveLength(1);
    t = 32400_000 - 59_000;
    await client.request({ method: "GET", path: "/a" });
    expect(calls.filter((c) => c.path === "/v1/oauth2/token")).toHaveLength(2);
  });
});

describe("retries", () => {
  it("retries a 503 then succeeds, reusing the request id", async () => {
    let n = 0;
    const { client, calls } = makeClient(() =>
      ++n === 1 ? json(503, { name: "SERVICE_UNAVAILABLE" }) : json(200, { ok: 1 }),
    );
    await expect(client.request({ method: "POST", path: "/x" })).resolves.toEqual({ ok: 1 });
    const [first, second] = apiCalls(calls);
    expect(apiCalls(calls)).toHaveLength(2);
    expect(first!.headers["PayPal-Request-Id"]).toBe(second!.headers["PayPal-Request-Id"]);
  });

  it("retries a network error", async () => {
    let n = 0;
    const { client } = makeClient(() => {
      if (++n === 1) throw new TypeError("fetch failed");
      return json(200, { ok: 1 });
    });
    await expect(client.request({ method: "GET", path: "/x" })).resolves.toEqual({ ok: 1 });
  });

  it("gives up after 3 retries", async () => {
    const { client, calls } = makeClient(() => json(500, { name: "INTERNAL_SERVER_ERROR" }));
    await expect(client.request({ method: "GET", path: "/x" })).rejects.toMatchObject({ status: 500 });
    expect(apiCalls(calls)).toHaveLength(4);
  });

  it("does not retry a 400", async () => {
    const { client, calls } = makeClient(() => json(400, { name: "INVALID_REQUEST" }));
    await expect(client.request({ method: "GET", path: "/x" })).rejects.toBeInstanceOf(PayPalError);
    expect(apiCalls(calls)).toHaveLength(1);
  });
});

describe("errors", () => {
  it("parses name, issue and debug id", async () => {
    const { client } = makeClient(() =>
      json(
        422,
        { name: "UNPROCESSABLE_ENTITY", message: "too soon", details: [{ issue: "REAUTHORIZATION_TOO_SOON" }] },
        { "paypal-debug-id": "abc123" },
      ),
    );
    const err = await client.request({ method: "POST", path: "/x" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PayPalError);
    expect(err).toMatchObject({
      status: 422,
      errorName: "UNPROCESSABLE_ENTITY",
      issue: "REAUTHORIZATION_TOO_SOON",
      debugId: "abc123",
    });
  });

  it("copes with a non-JSON error body", async () => {
    const { client } = makeClient(() => new Response("nope", { status: 404 }));
    await expect(client.request({ method: "GET", path: "/x" })).rejects.toMatchObject({ status: 404, debugId: null });
  });
});

describe("logging", () => {
  it("logs each call without secrets", async () => {
    const { client, logs } = makeClient(() => json(200, {}, { "paypal-debug-id": "d1" }));
    await client.request({ method: "POST", path: "/x", requestId: "r1" });
    expect(logs).toContainEqual(expect.objectContaining({ path: "/x", status: 200, debugId: "d1", requestId: "r1" }));
    const text = JSON.stringify(logs);
    expect(text).not.toMatch(/Bearer|Basic|secret/);
  });
});

describe("sandbox guard", () => {
  it.each(["https://api-m.paypal.com", "http://api-m.sandbox.paypal.com", "https://evil.example.com"])(
    "refuses %s",
    (apiBase) => {
      expect(() => createPayPalClient({ clientId: "a", clientSecret: "b", apiBase })).toThrow(/sandbox/);
    },
  );

  it("accepts the sandbox host", () => {
    expect(() =>
      createPayPalClient({ clientId: "a", clientSecret: "b", apiBase: "https://api-m.sandbox.paypal.com/" }),
    ).not.toThrow();
  });
});
