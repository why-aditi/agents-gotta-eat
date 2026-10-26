import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The visitor's request headers, as Next would give a server component.
let incoming = new Headers();
vi.mock("next/headers", () => ({ headers: async () => incoming }));

const { fetchDemoStatus, fetchMoneyLinks } = await import("./demo");

const status = {
  featured: null,
  live: { budgetUsed: 850, budget: 1000, fallback: true },
};
const link = {
  bountyId: "bty_1",
  bountyTitle: "Tagline",
  kind: "capture",
  paypalId: "3C679366HH908993F",
  url: "https://www.sandbox.paypal.com/activity/payment/3C679366HH908993F",
};

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  incoming = new Headers();
  vi.stubEnv("API_URL", "http://api.test/");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("public demo reads", () => {
  it("forwards the visitor's address for the api's per-IP rate limit", async () => {
    incoming = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    fetchMock.mockResolvedValue(Response.json(status));
    await fetchDemoStatus();
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)["x-forwarded-for"]).toBe("203.0.113.7");
  });

  it("reads the status without a token", async () => {
    fetchMock.mockResolvedValue(Response.json(status));
    expect(await fetchDemoStatus()).toEqual(status);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.test/v1/demo/status");
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it("returns null when the api is down, errors, or answers with the wrong shape", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await fetchDemoStatus()).toBeNull();
    fetchMock.mockResolvedValueOnce(Response.json({ error: { code: "rate_limited", message: "" } }, { status: 429 }));
    expect(await fetchDemoStatus()).toBeNull();
    fetchMock.mockResolvedValueOnce(Response.json({ ...status, live: { ...status.live, budgetUsed: 1.5 } }));
    expect(await fetchDemoStatus()).toBeNull();
  });

  it("returns null without API_URL", async () => {
    vi.stubEnv("API_URL", "");
    expect(await fetchDemoStatus()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads money links, orders without a url", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ links: [link] }));
    expect(await fetchMoneyLinks("rec 1")).toEqual([link]);
    expect(fetchMock.mock.calls[0]![0]).toBe("http://api.test/v1/demo/recordings/rec%201/money");
    const order = { ...link, kind: "order", url: null };
    fetchMock.mockResolvedValueOnce(Response.json({ links: [order] }));
    expect(await fetchMoneyLinks("rec_1")).toEqual([order]);
    fetchMock.mockResolvedValueOnce(Response.json({ error: { code: "not_found", message: "" } }, { status: 404 }));
    expect(await fetchMoneyLinks("rec_1")).toBeNull();
  });
});
