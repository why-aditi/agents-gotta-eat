import { afterAll, describe, expect, it, vi } from "vitest";
import { buildTestApp, createAgent, createTestDb, createUser, resetDb, signUserToken } from "../../test/db";
import { DEFAULT_AUTH_FAIL_PER_MINUTE, FixedWindowCounter, limitFromEnv } from "./rate-limit";

const { db, pool } = createTestDb();
afterAll(() => pool.end());

describe("limitFromEnv", () => {
  it("falls back when unset or malformed; 0 is allowed", () => {
    expect(limitFromEnv(undefined, 7)).toBe(7);
    expect(limitFromEnv("", 7)).toBe(7);
    expect(limitFromEnv("abc", 7)).toBe(7);
    expect(limitFromEnv("-1", 7)).toBe(7);
    expect(limitFromEnv("0", 7)).toBe(0);
    expect(limitFromEnv("25", 7)).toBe(25);
  });
});

describe("FixedWindowCounter", () => {
  it("never holds more than maxKeys: expired windows go first, then the oldest key", () => {
    const c = new FixedWindowCounter(3);
    for (const k of ["a", "b", "c", "d", "e"]) c.add(k, 1000);
    expect(c.size).toBe(3);
    expect(c.count("a", 1000)).toBe(0);
    expect(c.count("e", 1000)).toBe(1);
    c.add("f", 1000 + 61_000);
    expect(c.size).toBe(1);
  });

  it("remove gives an event back", () => {
    const c = new FixedWindowCounter();
    c.add("k", 0);
    c.add("k", 0);
    c.remove("k", 0, c.windowStart("k", 0)!);
    expect(c.count("k", 0)).toBe(1);
  });

  it("remove across a window boundary leaves the new window alone", () => {
    const c = new FixedWindowCounter();
    c.add("k", 0);
    const start = c.windowStart("k", 0)!;
    c.add("k", 61_000);
    c.add("k", 61_000);
    c.remove("k", 62_000, start);
    expect(c.count("k", 62_000)).toBe(2);
  });
});

describe("api rate limits", () => {
  it("IP ceiling (5x the general limit): past it a caller gets 429 rate_limited in the envelope with Retry-After; /health is exempt", async () => {
    const app = buildTestApp(db, { RATE_LIMIT_PER_MINUTE: "1" });
    await app.ready();
    try {
      for (let i = 0; i < 5; i++) expect((await app.inject({ method: "GET", url: "/v1/nope" })).statusCode).toBe(404);
      const res = await app.inject({ method: "GET", url: "/v1/nope" });
      expect(res.statusCode).toBe(429);
      expect(Number(res.headers["retry-after"])).toBeGreaterThanOrEqual(1);
      expect(res.json()).toMatchObject({ error: { code: "rate_limited", detail: { limit: 5, windowSeconds: 60 } } });
      expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it("a fresh random agent-key token per request gets no new budget", async () => {
    const app = buildTestApp(db, { RATE_LIMIT_PER_MINUTE: "1" });
    await app.ready();
    try {
      const codes: number[] = [];
      for (let i = 0; i < 8; i++) {
        const res = await app.inject({
          method: "GET",
          url: "/v1/nope",
          headers: { authorization: `Bearer gte_agent_random${i}` },
        });
        codes.push(res.statusCode);
      }
      expect(codes.slice(-3)).toEqual([429, 429, 429]);
    } finally {
      await app.close();
    }
  });

  it("general: each agent key has its own budget", async () => {
    await resetDb(db);
    const a = await createAgent(db, await createUser(db));
    const b = await createAgent(db, await createUser(db));
    const app = buildTestApp(db, { RATE_LIMIT_PER_MINUTE: "3" });
    await app.ready();
    try {
      const get = (key: string) =>
        app.inject({ method: "GET", url: "/v1/agents/me", headers: { authorization: `Bearer ${key}` } });
      for (let i = 0; i < 3; i++) expect((await get(a.apiKey)).statusCode).toBe(200);
      expect((await get(a.apiKey)).statusCode).toBe(429);
      expect((await get(b.apiKey)).statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it("auth failures: repeated bad credentials lock the IP out with 429 and Retry-After", async () => {
    const app = buildTestApp(db, { RATE_LIMIT_AUTH_FAIL_PER_MINUTE: "3" });
    await app.ready();
    try {
      const bad = () =>
        app.inject({ method: "GET", url: "/v1/agents", headers: { authorization: "Bearer gte_agent_wrong" } });
      for (let i = 0; i < 3; i++) expect((await bad()).statusCode).toBe(401);
      const res = await bad();
      expect(res.statusCode).toBe(429);
      expect(res.headers["retry-after"]).toBeDefined();
      expect(res.json().error.code).toBe("rate_limited");
    } finally {
      await app.close();
    }
  });

  it("auth failures: once an IP has failed, a concurrent burst of bad credentials is cut off, not all let through", async () => {
    const app = buildTestApp(db, { RATE_LIMIT_AUTH_FAIL_PER_MINUTE: "3" });
    await app.ready();
    try {
      const first = await app.inject({
        method: "GET",
        url: "/v1/agents",
        headers: { authorization: "Bearer gte_agent_wrong" },
      });
      expect(first.statusCode).toBe(401);
      const res = await Promise.all(
        Array.from({ length: 12 }, () =>
          app.inject({ method: "GET", url: "/v1/agents", headers: { authorization: "Bearer gte_agent_wrong" } }),
        ),
      );
      expect(res.filter((r) => r.statusCode === 401).length).toBeLessThanOrEqual(2);
      expect(res.filter((r) => r.statusCode === 429).length).toBeGreaterThanOrEqual(10);
    } finally {
      await app.close();
    }
  });

  it("auth failures: valid credentials give their reservation back and never lock the caller out", async () => {
    await resetDb(db);
    const a = await createAgent(db, await createUser(db));
    const app = buildTestApp(db, { RATE_LIMIT_AUTH_FAIL_PER_MINUTE: "2" });
    await app.ready();
    try {
      for (let i = 0; i < 8; i++) {
        const res = await app.inject({
          method: "GET",
          url: "/v1/nope",
          headers: { authorization: `Bearer ${a.apiKey}` },
        });
        expect(res.statusCode).toBe(404);
      }
    } finally {
      await app.close();
    }
  });

  describe("hard-01 item 6: the default failed-auth throttle", () => {
    // Unset in the env: the defaults apply (buildTestApp turns the limits off otherwise).
    const defaults = { RATE_LIMIT_PER_MINUTE: undefined, RATE_LIMIT_AUTH_FAIL_PER_MINUTE: undefined };
    // Takes an agent key or a user token.
    const SEARCH = "/v1/agents/search";
    const asIp = (remoteAddress: string, authorization: string) => ({
      method: "GET" as const,
      url: "/v1/agents/me",
      remoteAddress,
      headers: { authorization },
    });

    it("the 21st bad agent key from an IP gets 429 rate_limited with Retry-After, without checking keys; other IPs and the next window are unaffected", async () => {
      await resetDb(db);
      const a = await createAgent(db, await createUser(db));
      const app = buildTestApp(db, defaults);
      await app.ready();
      const now = Date.now();
      const clock = vi.spyOn(Date, "now").mockReturnValue(now);
      try {
        expect(DEFAULT_AUTH_FAIL_PER_MINUTE).toBe(20);
        for (let i = 0; i < 20; i++) {
          expect((await app.inject(asIp("10.0.0.1", `Bearer gte_agent_wrong${i}`))).statusCode).toBe(401);
        }
        const res = await app.inject(asIp("10.0.0.1", "Bearer gte_agent_wrong21"));
        expect(res.statusCode).toBe(429);
        expect(Number(res.headers["retry-after"])).toBeGreaterThanOrEqual(1);
        expect(Number(res.headers["retry-after"])).toBeLessThanOrEqual(60);
        expect(res.json()).toMatchObject({ error: { code: "rate_limited", detail: { limit: 20, windowSeconds: 60 } } });
        // Answered before the key is checked: a valid key from the throttled IP waits too (the documented trade-off).
        expect((await app.inject(asIp("10.0.0.1", `Bearer ${a.apiKey}`))).statusCode).toBe(429);
        // Another address is untouched.
        expect((await app.inject(asIp("10.0.0.2", `Bearer ${a.apiKey}`))).statusCode).toBe(200);
        // A request without credentials isn't an authentication attempt.
        expect((await app.inject({ method: "GET", url: "/health", remoteAddress: "10.0.0.1" })).statusCode).toBe(200);
        // The window passes: the IP is let through again.
        clock.mockReturnValue(now + 61_000);
        expect((await app.inject(asIp("10.0.0.1", `Bearer ${a.apiKey}`))).statusCode).toBe(200);
      } finally {
        clock.mockRestore();
        await app.close();
      }
    });

    it("bad user bearer tokens count too", async () => {
      const app = buildTestApp(db, defaults);
      await app.ready();
      try {
        const forged = await signUserToken({ secret: "not-the-server-secret-but-32-bytes-long!!" });
        for (let i = 0; i < 20; i++) {
          expect((await app.inject(asIp("10.0.1.1", `Bearer ${forged}`))).statusCode).toBe(401);
        }
        expect((await app.inject(asIp("10.0.1.1", `Bearer ${forged}`))).statusCode).toBe(429);
        expect((await app.inject(asIp("10.0.1.1", "Bearer not.a.jwt"))).statusCode).toBe(429);
      } finally {
        await app.close();
      }
    });

    it("valid traffic alone never trips it: 100 sequential and 60 concurrent requests from one IP, agent key and user token", async () => {
      await resetDb(db);
      const a = await createAgent(db, await createUser(db));
      const user = `Bearer ${await signUserToken({ email: "throttle@test.local" })}`;
      const app = buildTestApp(db, defaults);
      await app.ready();
      try {
        for (let i = 0; i < 100; i++) {
          const auth = i % 2 ? user : `Bearer ${a.apiKey}`;
          expect((await app.inject({ ...asIp("10.0.2.1", auth), url: SEARCH })).statusCode).toBe(200);
        }
        const burst = await Promise.all(
          Array.from({ length: 60 }, (_, i) =>
            app.inject({ ...asIp("10.0.2.1", i % 2 ? user : `Bearer ${a.apiKey}`), url: SEARCH }),
          ),
        );
        expect(burst.map((r) => r.statusCode).filter((c) => c !== 200)).toEqual([]);
      } finally {
        await app.close();
      }
    });

    it("AUTH_FAIL_LIMIT sets it; RATE_LIMIT_AUTH_FAIL_PER_MINUTE wins when both are set", async () => {
      const alias = buildTestApp(db, { ...defaults, AUTH_FAIL_LIMIT: "2" });
      const both = buildTestApp(db, { ...defaults, AUTH_FAIL_LIMIT: "2", RATE_LIMIT_AUTH_FAIL_PER_MINUTE: "0" });
      await Promise.all([alias.ready(), both.ready()]);
      try {
        const codes = async (app: typeof alias) => {
          const out: number[] = [];
          for (let i = 0; i < 4; i++) {
            out.push((await app.inject(asIp("10.0.3.1", "Bearer gte_agent_wrong"))).statusCode);
          }
          return out;
        };
        expect(await codes(alias)).toEqual([401, 401, 429, 429]);
        expect(await codes(both)).toEqual([401, 401, 401, 401]);
      } finally {
        await Promise.all([alias.close(), both.close()]);
      }
    });
  });

  it("0 turns both limits off", async () => {
    const app = buildTestApp(db, { RATE_LIMIT_PER_MINUTE: "0", RATE_LIMIT_AUTH_FAIL_PER_MINUTE: "0" });
    await app.ready();
    try {
      for (let i = 0; i < 40; i++) {
        const res = await app.inject({
          method: "GET",
          url: "/v1/agents",
          headers: { authorization: "Bearer gte_agent_wrong" },
        });
        expect(res.statusCode).toBe(401);
      }
    } finally {
      await app.close();
    }
  });
});
