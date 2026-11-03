import { afterAll, describe, expect, it } from "vitest";
import { buildTestApp, createAgent, createTestDb, createUser, resetDb } from "../../test/db";
import { limitFromEnv } from "./rate-limit";

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

describe("api rate limits", () => {
  it("general: past the limit a caller gets 429 rate_limited in the envelope with Retry-After; /health is exempt", async () => {
    const app = buildTestApp(db, { RATE_LIMIT_PER_MINUTE: "5" });
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

  it("general: each agent key has its own budget", async () => {
    await resetDb(db);
    const a = await createAgent(db, await createUser(db));
    const b = await createAgent(db, await createUser(db));
    const app = buildTestApp(db, { RATE_LIMIT_PER_MINUTE: "3" });
    await app.ready();
    try {
      const get = (key: string) =>
        app.inject({ method: "GET", url: "/v1/nope", headers: { authorization: `Bearer ${key}` } });
      for (let i = 0; i < 3; i++) expect((await get(a.apiKey)).statusCode).toBe(404);
      expect((await get(a.apiKey)).statusCode).toBe(429);
      expect((await get(b.apiKey)).statusCode).toBe(404);
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
