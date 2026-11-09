import { afterAll, describe, expect, it } from "vitest";
import { buildTestApp, createTestDb } from "../../test/db";
import { buildProxyTrust, demoClientIp } from "./client-ip";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
const defaults = { RATE_LIMIT_PER_MINUTE: undefined, RATE_LIMIT_AUTH_FAIL_PER_MINUTE: undefined };

describe("buildProxyTrust", () => {
  it("trusts private, loopback, IPv4-mapped and Cloudflare addresses, not other public ones", () => {
    const t = buildProxyTrust();
    for (const a of ["10.1.2.3", "172.16.0.9", "127.0.0.1", "::1", "::ffff:10.0.0.4", "172.70.1.1", "2606:4700::1"]) {
      expect(t(a), a).toBe(true);
    }
    for (const a of ["1.2.3.4", "203.0.113.7", "172.32.0.1", "2001:db8::1", "garbage", ""]) expect(t(a), a).toBe(false);
  });
  it("TRUST_PROXY_CIDRS adds ranges and ignores junk", () => {
    const t = buildProxyTrust("203.0.113.0/24, 198.51.100.9, nope, 1.2.3.4/xx");
    expect(t("203.0.113.50")).toBe(true);
    expect(t("198.51.100.9")).toBe(true);
    expect(t("1.2.3.4")).toBe(false);
  });
});

describe("demoClientIp", () => {
  it("first X-Forwarded-For entry when proxies are trusted, else req.ip", () => {
    const req = { ip: "9.9.9.9", headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" } };
    expect(demoClientIp(req, true)).toBe("203.0.113.7");
    expect(demoClientIp(req, false)).toBe("9.9.9.9");
    expect(demoClientIp({ ip: "9.9.9.9", headers: { "x-forwarded-for": "junk" } }, true)).toBe("9.9.9.9");
  });
});

describe("failed-auth throttle behind the hosted proxy chain", () => {
  const bad = (i: number, remoteAddress: string, xff?: string) => ({
    method: "GET" as const,
    url: "/v1/agents/me",
    remoteAddress,
    headers: { authorization: `Bearer gte_agent_bad${i}`, ...(xff ? { "x-forwarded-for": xff } : {}) },
  });
  async function run(chain: (i: number) => [string, string?], n = 25) {
    const app = buildTestApp(db, { ...defaults, TRUST_PROXY_HOPS: "2" });
    await app.ready();
    try {
      const codes: number[] = [];
      for (let i = 0; i < n; i++) codes.push((await app.inject(bad(i, ...chain(i)))).statusCode);
      return codes;
    } finally {
      await app.close();
    }
  }
  const engaged = (codes: number[]) => expect(codes.slice(20)).toEqual(Array(codes.length - 20).fill(429));

  // Regression: with the hop-count rule these chains resolved to a per-request proxy address and never throttled.
  it("client, Cloudflare edge, Render proxy address varying per request", async () => {
    engaged(await run((i) => ["10.0.0.5", `198.51.100.23, 172.70.${i}.1, 10.4.${i}.2`]));
  });
  it("client, rotating Cloudflare edge", async () => {
    engaged(await run((i) => ["10.0.0.5", `198.51.100.23, 172.70.${i}.1`]));
  });
  it("only the client (one hop) and none at all", async () => {
    engaged(await run(() => ["10.0.0.5", "198.51.100.23"]));
    engaged(await run(() => ["10.0.0.5"]));
  });

  it("forging X-Forwarded-For does not evade it: rotating forged leftmost entries share the real client's budget", async () => {
    engaged(await run((i) => ["10.0.0.5", `1.1.${i}.1, 2.2.${i}.2, 198.51.100.23, 172.70.1.1`]));
  });

  it("different real clients behind the same proxies do not share a budget", async () => {
    const app = buildTestApp(db, { ...defaults, TRUST_PROXY_HOPS: "2" });
    await app.ready();
    try {
      for (let i = 0; i < 25; i++) await app.inject(bad(i, "10.0.0.5", "198.51.100.23, 172.70.1.1"));
      const other = await app.inject(bad(99, "10.0.0.5", "198.51.100.24, 172.70.1.1"));
      expect(other.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("without TRUST_PROXY_HOPS the header is ignored: the socket address is the client", async () => {
    const app = buildTestApp(db, defaults);
    await app.ready();
    try {
      const codes: number[] = [];
      for (let i = 0; i < 22; i++) codes.push((await app.inject(bad(i, "10.0.0.5", `5.5.${i}.5`))).statusCode);
      expect(codes.slice(20)).toEqual([429, 429]);
    } finally {
      await app.close();
    }
  });
});
