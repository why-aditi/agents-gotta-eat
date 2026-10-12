import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { arg, formatCents, loadState, parseCents, paypal, resetTokenCache, saveState, setOutDir } from "./lib";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE = "https://api-m.sandbox.paypal.com";

describe("formatCents", () => {
  it.each([
    [5500n, "55.00"],
    [5n, "0.05"],
    [0n, "0.00"],
    [123456n, "1234.56"],
    [100n, "1.00"],
    [90071992547409931n, "900719925474099.31"],
  ])("%s -> %s", (cents, expected) => {
    expect(formatCents(cents)).toBe(expected);
  });

  it("throws on negative", () => {
    expect(() => formatCents(-1n)).toThrow();
  });
});

describe("parseCents", () => {
  it("parses digits to bigint", () => {
    expect(parseCents("5500")).toBe(5500n);
  });
  it.each(["55.00", "-5", "", "1e3", "abc"])("rejects %j", (raw) => {
    expect(() => parseCents(raw)).toThrow();
  });
});

describe("arg", () => {
  it("reads --name value and --name=value", () => {
    expect(arg("label", ["--intent", "AUTHORIZE", "--label", "A"])).toBe("A");
    expect(arg("cents", ["--cents=5500"])).toBe("5500");
    expect(arg("missing", ["--label", "A"])).toBeUndefined();
    expect(arg("label", ["--label", "--cents", "1"])).toBeUndefined();
  });
});

interface Captured {
  url: string;
  init: RequestInit;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "paypal-debug-id": "dbg123" },
  });
}

describe("paypal()", () => {
  let dir: string;
  let calls: Captured[];
  let apiResponse: () => Response;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "spike-paypal-"));
    setOutDir(dir);
    resetTokenCache();
    vi.stubEnv("PAYPAL_CLIENT_ID", "client-id");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "super-secret");
    vi.stubEnv("PAYPAL_API_BASE", BASE);
    calls = [];
    apiResponse = () => jsonResponse(201, { id: "ORDER1", status: "CREATED" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        calls.push({ url, init: init ?? {} });
        if (url.endsWith("/v1/oauth2/token")) return jsonResponse(200, { access_token: "tok-abc", expires_in: 32400 });
        return apiResponse();
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    setOutDir(undefined);
    resetTokenCache();
    rmSync(dir, { recursive: true, force: true });
  });

  const apiCalls = () => calls.filter((c) => !c.url.endsWith("/v1/oauth2/token"));
  const header = (c: Captured, name: string) => new Headers(c.init.headers).get(name);

  it("sends bearer token, a fresh UUID request id, and a JSON body; fetches the token once", async () => {
    const body = { intent: "AUTHORIZE", amount: { value: formatCents(5500n) } };
    const first = await paypal("POST", "/v2/checkout/orders", body, "one");
    const second = await paypal("POST", "/v2/checkout/orders", body, "two");

    expect(calls.filter((c) => c.url.endsWith("/v1/oauth2/token"))).toHaveLength(1);
    const [a, b] = apiCalls();
    if (!a || !b) throw new Error("expected two API calls");

    expect(a.url).toBe(`${BASE}/v2/checkout/orders`);
    expect(a.init.method).toBe("POST");
    expect(header(a, "Authorization")).toBe("Bearer tok-abc");
    expect(header(a, "Content-Type")).toBe("application/json");
    expect(JSON.parse(String(a.init.body))).toEqual(body);

    const idA = header(a, "PayPal-Request-Id");
    const idB = header(b, "PayPal-Request-Id");
    expect(idA).toMatch(UUID_RE);
    expect(idB).toMatch(UUID_RE);
    expect(idA).not.toBe(idB);
    expect(first.requestId).toBe(idA);
    expect(second.requestId).toBe(idB);

    expect(first.ok).toBe(true);
    expect(first.status).toBe(201);
    expect(first.body).toEqual({ id: "ORDER1", status: "CREATED" });
    expect(first.debugId).toBe("dbg123");
  });

  it("sends no body when none is given", async () => {
    await paypal("POST", "/v2/checkout/orders/X/authorize", undefined, "auth");
    expect(apiCalls()[0]?.init.body).toBeUndefined();
  });

  it("returns the parsed error body on 4xx instead of throwing", async () => {
    const error = {
      name: "UNPROCESSABLE_ENTITY",
      details: [{ issue: "REAUTHORIZATION_TOO_SOON", description: "too soon" }],
      debug_id: "abc",
    };
    apiResponse = () => jsonResponse(422, error);
    const res = await paypal("POST", "/v2/payments/authorizations/AUTH1/reauthorize", undefined, "reauth");
    expect(res.ok).toBe(false);
    expect(res.status).toBe(422);
    expect(res.body).toEqual(error);
  });

  it("logs request and response without the Authorization header or secrets", async () => {
    const res = await paypal("GET", "/v1/payments/payouts/B1", undefined, "payout-status");
    const files = readdirSync(dir).filter((f) => f.endsWith("-payout-status.json"));
    expect(files).toHaveLength(1);
    expect(join(dir, files[0] ?? "")).toBe(res.logFile);
    const text = readFileSync(res.logFile, "utf8");
    expect(text).not.toMatch(/authorization/i);
    expect(text).not.toContain("tok-abc");
    expect(text).not.toContain("super-secret");
    const log = JSON.parse(text) as { request: { headers: Record<string, string> }; response: { status: number } };
    expect(log.request.headers["PayPal-Request-Id"]).toBe(res.requestId);
    expect(log.response.status).toBe(201);
  });

  it("refuses a non-sandbox base URL", async () => {
    vi.stubEnv("PAYPAL_API_BASE", "https://api-m.paypal.com");
    await expect(paypal("GET", "/v2/checkout/orders/X", undefined, "live")).rejects.toThrow(/sandbox/);
  });
});

describe("state", () => {
  it("round-trips labels and batches", () => {
    const dir = mkdtempSync(join(tmpdir(), "spike-state-"));
    setOutDir(dir);
    try {
      expect(loadState()).toEqual({ labels: {}, payoutBatches: [] });
      saveState({
        labels: { A: { orderId: "O1", intent: "AUTHORIZE", cents: "5500", authorizationHistory: [] } },
        payoutBatches: ["B1"],
      });
      expect(loadState().labels.A?.cents).toBe("5500");
      expect(loadState().payoutBatches).toEqual(["B1"]);
    } finally {
      setOutDir(undefined);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
