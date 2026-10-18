import { Me } from "@gottaeat/schemas";
import { jwtVerify } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth: authMock }));

import { ApiError, apiFetch, getMe, signApiToken } from "./api";

const SECRET = "test-secret";
const key = new TextEncoder().encode(SECRET);

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("signApiToken", () => {
  it("signs an HS256 token the api accepts: lowercased sub, name, 10-minute lifetime", async () => {
    const now = new Date("2026-10-18T12:00:00.500Z");
    const token = await signApiToken("  Owner@Example.COM ", "Owner", SECRET, now);
    const { payload, protectedHeader } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      currentDate: now,
    });
    expect(protectedHeader.alg).toBe("HS256");
    expect(payload.sub).toBe("owner@example.com");
    expect(payload.name).toBe("Owner");
    expect(payload.iat).toBe(Math.floor(now.getTime() / 1000));
    expect(payload.exp! - payload.iat!).toBe(600);
  });

  it("omits an empty name and fails verification with another secret", async () => {
    const token = await signApiToken("a@b.co", null, SECRET, new Date());
    const { payload } = await jwtVerify(token, key);
    expect(payload).not.toHaveProperty("name");
    await expect(jwtVerify(token, new TextEncoder().encode("other"))).rejects.toThrow();
  });
});

describe("apiFetch", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubEnv("API_URL", "http://api.test/");
    vi.stubEnv("API_JWT_SECRET", SECRET);
    vi.stubGlobal("fetch", fetchMock);
    authMock.mockResolvedValue({ user: { email: "Demo-Owner@gottaeat.dev", name: "Demo owner" } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    authMock.mockReset();
  });

  it("sends a bearer token, JSON body and Idempotency-Key, and parses the response", async () => {
    fetchMock.mockResolvedValue(json(201, { id: "agt_1", extra: "dropped" }));
    const result = await apiFetch(z.object({ id: z.string() }), "/v1/agents", {
      method: "POST",
      body: { name: "patch" },
      idempotencyKey: "key-1",
    });
    expect(result).toEqual({ id: "agt_1" });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api.test/v1/agents");
    expect(init?.method).toBe("POST");
    expect(init?.cache).toBe("no-store");
    expect(init?.body).toBe(JSON.stringify({ name: "patch" }));
    const headers = init?.headers as Record<string, string>;
    expect(headers["idempotency-key"]).toBe("key-1");
    expect(headers["content-type"]).toBe("application/json");
    const token = headers.authorization!.replace(/^Bearer /, "");
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    expect(payload.sub).toBe("demo-owner@gottaeat.dev");
    expect(payload.name).toBe("Demo owner");
    expect(payload.exp! - payload.iat!).toBe(600);
  });

  it("defaults to GET with no body or Idempotency-Key", async () => {
    fetchMock.mockResolvedValue(json(200, { id: "usr_1", email: "demo-owner@gottaeat.dev", name: null, roles: [] }));
    const me = await getMe();
    expect(Me.parse(me).id).toBe("usr_1");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api.test/v1/me");
    expect(init?.method).toBe("GET");
    expect(init?.body).toBeUndefined();
    expect(init?.headers).not.toHaveProperty("idempotency-key");
  });

  it("returns null for 204", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(apiFetch(null, "/v1/agents/agt_1/key", { method: "DELETE" })).resolves.toBeNull();
  });

  it("maps the error envelope to ApiError", async () => {
    fetchMock.mockResolvedValue(
      json(402, { error: { code: "insufficient_funds", message: "Not enough money", detail: { needed: 500 } } }),
    );
    const err = await apiFetch(null, "/v1/approvals/sr_1", { method: "POST", body: {} }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 402,
      code: "insufficient_funds",
      message: "Not enough money",
      detail: { needed: 500 },
    });
  });

  it("falls back to code internal when the body is not an envelope", async () => {
    fetchMock.mockResolvedValue(new Response("<html>bad gateway</html>", { status: 502 }));
    const err = await apiFetch(null, "/v1/me").catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 502, code: "internal" });
  });

  it("throws on a response that doesn't match the schema", async () => {
    fetchMock.mockResolvedValue(json(200, { nope: true }));
    await expect(apiFetch(Me, "/v1/me")).rejects.toThrow();
  });

  it("throws without a session and never calls the api", async () => {
    authMock.mockResolvedValue(null);
    await expect(apiFetch(Me, "/v1/me")).rejects.toMatchObject({ status: 401, code: "unauthorized" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws a clear error when API_URL or API_JWT_SECRET is missing", async () => {
    vi.stubEnv("API_JWT_SECRET", "");
    await expect(apiFetch(Me, "/v1/me")).rejects.toThrow(/API_JWT_SECRET is not set/);
    vi.stubEnv("API_URL", "");
    await expect(apiFetch(Me, "/v1/me")).rejects.toThrow(/API_URL is not set/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
