import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp, createAgent, createTestDb, createUser, resetDb, signUserToken } from "../../../test/db";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(() => resetDb(db));

describe("GET /v1/me", () => {
  it("returns the signed-in user with roles", async () => {
    const app = buildTestApp(db);
    const token = await signUserToken({ email: "me@example.com", name: "Me" });
    const first = await app.inject({ method: "GET", url: "/v1/me", headers: { authorization: `Bearer ${token}` } });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ email: "me@example.com", name: "Me", roles: [] });

    await db.execute(sql`update users set roles = '{admin}' where email = 'me@example.com'`);
    const second = await app.inject({ method: "GET", url: "/v1/me", headers: { authorization: `Bearer ${token}` } });
    expect(second.json().roles).toEqual(["admin"]);
    await app.close();
  });

  it("rejects agents and anonymous callers", async () => {
    const app = buildTestApp(db);
    const owner = await createUser(db);
    const { apiKey } = await createAgent(db, owner);
    const asAgent = await app.inject({ method: "GET", url: "/v1/me", headers: { authorization: `Bearer ${apiKey}` } });
    expect(asAgent.statusCode).toBe(403);
    const anon = await app.inject({ method: "GET", url: "/v1/me" });
    expect(anon.statusCode).toBe(401);
    await app.close();
  });
});
