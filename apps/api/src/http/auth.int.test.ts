import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp, createAgent, createTestDb, createUser, resetDb, signUserToken } from "../../test/db";
import { users } from "../db/schema";
import { buildApp } from "../app";

const { db, pool } = createTestDb();
const app = buildTestApp(db);
app.get("/v1/_test/user", { config: { auth: "user" } }, async (req) => req.principal);
app.get("/v1/_test/agent", { config: { auth: "agent" } }, async (req) => req.principal);
app.get("/v1/_test/any", { config: { auth: "any" } }, async (req) => req.principal);

beforeAll(() => app.ready());
beforeEach(() => resetDb(db));
afterAll(async () => {
  await app.close();
  await pool.end();
});

function get(url: string, authorization?: string) {
  return app.inject({ method: "GET", url, headers: authorization ? { authorization } : {} });
}

function expect401(res: { statusCode: number; json: () => { error: { code: string } } }) {
  expect(res.statusCode).toBe(401);
  expect(res.json().error.code).toBe("unauthorized");
}

describe("401 unauthorized", () => {
  it("no header", async () => {
    expect401(await get("/v1/_test/user"));
    expect401(await get("/v1/_test/agent"));
  });

  it("non-Bearer scheme", async () => {
    const token = await signUserToken({});
    expect401(await get("/v1/_test/user", `Basic ${token}`));
    expect401(await get("/v1/_test/user", token));
  });

  it("unknown agent key", async () => {
    expect401(await get("/v1/_test/agent", `Bearer gte_agent_${"A".repeat(43)}`));
    expect401(await get("/v1/_test/agent", "Bearer gte_agent_short"));
  });

  it("revoked key", async () => {
    const owner = await createUser(db);
    const { apiKey } = await createAgent(db, owner, { revoked: true });
    expect401(await get("/v1/_test/agent", `Bearer ${apiKey}`));
  });

  it("suspended agent", async () => {
    const owner = await createUser(db);
    const { apiKey } = await createAgent(db, owner, { status: "suspended" });
    expect401(await get("/v1/_test/agent", `Bearer ${apiKey}`));
  });

  it("JWT signed with the wrong secret", async () => {
    const token = await signUserToken({ secret: "a-different-secret-that-is-also-long-enough" });
    expect401(await get("/v1/_test/user", `Bearer ${token}`));
  });

  it("expired JWT", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signUserToken({ iat: now - 400, exp: now - 100 });
    expect401(await get("/v1/_test/user", `Bearer ${token}`));
  });

  it("JWT without sub, iat or exp", async () => {
    for (const omit of [["sub"], ["iat"], ["exp"]] as const) {
      const token = await signUserToken({ omit: [...omit] });
      expect401(await get("/v1/_test/user", `Bearer ${token}`));
    }
  });

  it("JWT whose sub is not an email", async () => {
    const token = await signUserToken({ email: "not-an-email" });
    expect401(await get("/v1/_test/user", `Bearer ${token}`));
  });

  it("JWT with exp more than 10 minutes after iat", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signUserToken({ iat: now, exp: now + 601 });
    expect401(await get("/v1/_test/user", `Bearer ${token}`));
  });

  it("garbage bearer token", async () => {
    expect401(await get("/v1/_test/user", "Bearer not.a.jwt"));
  });
});

describe("valid credentials", () => {
  it("agent key passes and sets the agent principal", async () => {
    const owner = await createUser(db);
    const { agentId, apiKey } = await createAgent(db, owner);
    const res = await get("/v1/_test/agent", `Bearer ${apiKey}`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ type: "agent", agentId, ownerId: owner, name: "Test agent" });
  });

  it("JWT passes and sets the user principal (exactly 10 minutes is allowed)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signUserToken({ email: "Ada@Test.local", iat: now, exp: now + 600 });
    const res = await get("/v1/_test/user", `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ type: "user", email: "ada@test.local", roles: [] });
    expect(res.json().userId).toMatch(/^usr_/);
  });

  it("`any` accepts both", async () => {
    const owner = await createUser(db);
    const { apiKey } = await createAgent(db, owner);
    expect((await get("/v1/_test/any", `Bearer ${apiKey}`)).json().type).toBe("agent");
    expect((await get("/v1/_test/any", `Bearer ${await signUserToken({})}`)).json().type).toBe("user");
  });
});

describe("403 forbidden", () => {
  it("agent on a user route and user on an agent route", async () => {
    const owner = await createUser(db);
    const { apiKey } = await createAgent(db, owner);
    const a = await get("/v1/_test/user", `Bearer ${apiKey}`);
    expect(a.statusCode).toBe(403);
    expect(a.json().error.code).toBe("forbidden");
    const u = await get("/v1/_test/agent", `Bearer ${await signUserToken({})}`);
    expect(u.statusCode).toBe(403);
    expect(u.json().error.code).toBe("forbidden");
  });
});

describe("first-sight users", () => {
  it("creates the users row once, with the name from the token", async () => {
    const token = await signUserToken({ email: "new@test.local", name: "New Person" });
    const results = await Promise.all([1, 2, 3].map(() => get("/v1/_test/user", `Bearer ${token}`)));
    const ids = new Set(results.map((r) => r.json().userId));
    expect(ids.size).toBe(1);
    await get("/v1/_test/user", `Bearer ${token}`);
    const rows = await db.select().from(users).where(eq(users.email, "new@test.local"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("New Person");
    expect(rows[0]?.id).toBe([...ids][0]);
  });
});

describe("route registration", () => {
  it("rejects a /v1 route without config.auth", async () => {
    const bad = buildApp({ db, logger: false, env: { API_JWT_SECRET: "x".repeat(32) } });
    expect(() => bad.get("/v1/_test/undeclared", async () => ({}))).toThrow(/must declare config.auth/);
    await bad.close();
  });
});
