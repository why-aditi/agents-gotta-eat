import { CreateAgentResponse, RotateKeyResponse } from "@gottaeat/schemas";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp, createAgent, createTestDb, resetDb, signUserToken } from "../../../test/db";
import { agents, idempotencyKeys, ledgerAccounts, users, wallets } from "../../db/schema";
import { hashApiKey } from "../../http/auth";
import { walletAccount } from "../ledger";

const { db, pool } = createTestDb();
const app = buildTestApp(db);

beforeAll(() => app.ready());
beforeEach(() => resetDb(db));
afterAll(async () => {
  await app.close();
  await pool.end();
});

let keyCounter = 0;
const newIdemKey = () => `test-key-${++keyCounter}-${Date.now()}`;

async function userAuth(email = "owner@test.local") {
  return `Bearer ${await signUserToken({ email })}`;
}

async function userId(email: string): Promise<string> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (!row) throw new Error(`no user ${email}`);
  return row.id;
}

function post(url: string, authorization: string, body?: unknown, idempotencyKey: string | null = newIdemKey()) {
  return app.inject({
    method: "POST",
    url,
    headers: { authorization, ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}) },
    ...(body === undefined ? {} : { payload: body as Record<string, unknown> }),
  });
}

function get(url: string, authorization: string) {
  return app.inject({ method: "GET", url, headers: { authorization } });
}

function del(url: string, authorization: string) {
  return app.inject({ method: "DELETE", url, headers: { authorization } });
}

async function create(auth: string, body: unknown = { name: "Patch" }, key?: string) {
  const res = await post("/v1/agents", auth, body, key ?? newIdemKey());
  expect(res.statusCode).toBe(201);
  return CreateAgentResponse.parse(res.json());
}

describe("POST /v1/agents", () => {
  it("builds mcpConfig from PUBLIC_API_URL, trailing slashes trimmed", async () => {
    const publicApp = buildTestApp(db, { PUBLIC_API_URL: "https://api.example.com//" });
    try {
      const res = await publicApp.inject({
        method: "POST",
        url: "/v1/agents",
        headers: { authorization: await userAuth(), "idempotency-key": newIdemKey() },
        payload: { name: "Probe" },
      });
      expect(res.statusCode).toBe(201);
      const { mcpConfig } = CreateAgentResponse.parse(res.json());
      expect(mcpConfig.url).toBe("https://api.example.com/mcp");
      expect(mcpConfig.stdio.env.GOTTAEAT_API_URL).toBe("https://api.example.com");
    } finally {
      await publicApp.close();
    }
  });

  it("creates an agent whose key works on /agents/me, stores only the hash, and opens a wallet", async () => {
    const auth = await userAuth();
    const created = await create(auth, { name: "  Patch  " });
    const ownerId = await userId("owner@test.local");

    expect(created.agent).toMatchObject({ ownerId, name: "Patch", kind: "external", status: "active", rating: 0 });
    expect(created.apiKey).toMatch(/^gte_agent_[A-Za-z0-9_-]{43}$/);
    const apiKey = created.apiKey as string;
    expect(created.agent.apiKeyPrefix).toBe(apiKey.slice(0, 14));
    expect(created.mcpConfig).toEqual({
      url: "http://localhost:3001/mcp",
      headers: { Authorization: "Bearer <your API key>" },
      stdio: {
        command: "npx",
        args: ["-y", "@gottaeat/mcp"],
        env: { GOTTAEAT_API_KEY: "<your API key>", GOTTAEAT_API_URL: "http://localhost:3001" },
      },
    });
    // The plaintext key never lands in the copy-paste config.
    expect(JSON.stringify(created.mcpConfig)).not.toContain(apiKey);

    const me = await get("/v1/agents/me", `Bearer ${apiKey}`);
    expect(me.statusCode).toBe(200);
    expect(me.json()).toEqual(created.agent);

    // Only the hash is stored: no column of the row holds the plaintext key.
    const [row] = await db.select().from(agents).where(eq(agents.id, created.agent.id));
    expect(row?.apiKeyHash).toBe(hashApiKey(apiKey));
    expect(JSON.stringify(row)).not.toContain(apiKey);
    const leaked = await db.execute(
      sql`select count(*)::int as n from agents a where row_to_json(a)::text like ${"%" + apiKey + "%"}`,
    );
    expect(leaked.rows[0]).toEqual({ n: 0 });

    const [wallet] = await db.select().from(wallets).where(eq(wallets.ownerId, ownerId));
    expect(wallet).toMatchObject({ balanceCents: 0n, heldCents: 0n });
    const [account] = await db
      .select()
      .from(ledgerAccounts)
      .where(eq(ledgerAccounts.id, walletAccount(ownerId)));
    expect(account).toMatchObject({ type: "liability", ownerId });
  });

  it("a second agent reuses the owner's wallet", async () => {
    const auth = await userAuth();
    await create(auth, { name: "One" });
    await create(auth, { name: "Two" });
    const ownerId = await userId("owner@test.local");
    const rows = await db.select().from(wallets).where(eq(wallets.ownerId, ownerId));
    expect(rows).toHaveLength(1);
  });

  it("replay returns apiKey null and creates one agent row", async () => {
    const auth = await userAuth();
    const key = newIdemKey();
    const first = await post("/v1/agents", auth, { name: "Patch" }, key);
    expect(first.statusCode).toBe(201);
    const second = await post("/v1/agents", auth, { name: "Patch" }, key);
    expect(second.statusCode).toBe(201);
    expect(second.headers["idempotent-replayed"]).toBe("true");

    const a = CreateAgentResponse.parse(first.json());
    const b = CreateAgentResponse.parse(second.json());
    expect(a.apiKey).not.toBeNull();
    expect(b.apiKey).toBeNull();
    expect(b.agent).toEqual(a.agent);
    expect(b.mcpConfig).toEqual(a.mcpConfig);

    const rows = await db.select().from(agents);
    expect(rows).toHaveLength(1);

    const [stored] = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, key));
    expect(stored?.status).toBe("done");
    expect(stored?.responseStatus).toBe(201);
    expect((stored?.responseBody as { apiKey: unknown }).apiKey).toBeNull();
    expect(JSON.stringify(stored?.responseBody)).not.toContain(a.apiKey as string);
  });

  it("requires an Idempotency-Key", async () => {
    const res = await post("/v1/agents", await userAuth(), { name: "Patch" }, null);
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("idempotency_key_required");
  });

  it("non-admin asking for kind house gets 403", async () => {
    const res = await post("/v1/agents", await userAuth(), { name: "House", kind: "house" });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("forbidden");
    expect(await db.select().from(agents)).toHaveLength(0);
  });

  it("admin can create a house agent", async () => {
    const auth = await userAuth("admin@test.local");
    // The user row is created on first sight, so make one request before granting the role.
    expect((await get("/v1/agents", auth)).statusCode).toBe(200);
    await db
      .update(users)
      .set({ roles: ["admin"] })
      .where(eq(users.email, "admin@test.local"));
    const created = await create(auth, { name: "House", kind: "house" });
    expect(created.agent.kind).toBe("house");
  });

  it.each([
    ["empty", { name: "" }],
    ["whitespace only", { name: "   " }],
    ["too long", { name: "x".repeat(81) }],
    ["missing", {}],
    ["bad kind", { name: "Patch", kind: "robot" }],
  ])("validation error on %s name", async (_label, body) => {
    const res = await post("/v1/agents", await userAuth(), body);
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("validation_error");
    expect(await db.select().from(agents)).toHaveLength(0);
  });

  it("accepts an 80-char name", async () => {
    const created = await create(await userAuth(), { name: "x".repeat(80) });
    expect(created.agent.name).toHaveLength(80);
  });

  it("agent key on the user route gets 403", async () => {
    const created = await create(await userAuth());
    const res = await post("/v1/agents", `Bearer ${created.apiKey}`, { name: "Sub" });
    expect(res.statusCode).toBe(403);
  });

  it("no credentials gets 401", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/agents", payload: { name: "Patch" } });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /v1/agents", () => {
  it("lists the caller's agents only, newest first", async () => {
    const mine = await userAuth("me@test.local");
    const theirs = await userAuth("them@test.local");
    const a = await create(mine, { name: "A" });
    await create(theirs, { name: "Theirs" });
    const b = await create(mine, { name: "B" });
    const c = await create(mine, { name: "C" });

    const res = await get("/v1/agents", mine);
    expect(res.statusCode).toBe(200);
    const ids = (res.json() as { agents: { id: string }[] }).agents.map((x) => x.id);
    expect(ids).toEqual([c.agent.id, b.agent.id, a.agent.id]);
  });

  it("empty list for a new user", async () => {
    const res = await get("/v1/agents", await userAuth());
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ agents: [] });
  });
});

describe("GET /v1/agents/me", () => {
  it("user token gets 403", async () => {
    const res = await get("/v1/agents/me", await userAuth());
    expect(res.statusCode).toBe(403);
  });
});

describe("POST /v1/agents/:id/rotate-key", () => {
  it("old key gets 401, new key works", async () => {
    const auth = await userAuth();
    const created = await create(auth);
    const res = await post(`/v1/agents/${created.agent.id}/rotate-key`, auth);
    expect(res.statusCode).toBe(200);
    const rotated = RotateKeyResponse.parse(res.json());
    expect(rotated.apiKey).not.toBeNull();
    expect(rotated.apiKey).not.toBe(created.apiKey);
    expect(rotated.agent.apiKeyPrefix).toBe((rotated.apiKey as string).slice(0, 14));

    expect((await get("/v1/agents/me", `Bearer ${created.apiKey}`)).statusCode).toBe(401);
    const me = await get("/v1/agents/me", `Bearer ${rotated.apiKey}`);
    expect(me.statusCode).toBe(200);
    expect(me.json().id).toBe(created.agent.id);
  });

  it("replay returns apiKey null and does not rotate again", async () => {
    const auth = await userAuth();
    const created = await create(auth);
    const url = `/v1/agents/${created.agent.id}/rotate-key`;
    const key = newIdemKey();
    const first = await post(url, auth, undefined, key);
    expect(first.statusCode).toBe(200);
    const firstKey = RotateKeyResponse.parse(first.json()).apiKey as string;
    const [before] = await db.select().from(agents).where(eq(agents.id, created.agent.id));

    const second = await post(url, auth, undefined, key);
    expect(second.statusCode).toBe(200);
    expect(second.headers["idempotent-replayed"]).toBe("true");
    expect(RotateKeyResponse.parse(second.json()).apiKey).toBeNull();

    const [after] = await db.select().from(agents).where(eq(agents.id, created.agent.id));
    expect(after?.apiKeyHash).toBe(before?.apiKeyHash);
    expect((await get("/v1/agents/me", `Bearer ${firstKey}`)).statusCode).toBe(200);

    const [stored] = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, key));
    expect((stored?.responseBody as { apiKey: unknown }).apiKey).toBeNull();
  });

  it("restores a revoked key", async () => {
    const auth = await userAuth();
    const created = await create(auth);
    expect((await del(`/v1/agents/${created.agent.id}/key`, auth)).statusCode).toBe(204);
    const res = await post(`/v1/agents/${created.agent.id}/rotate-key`, auth);
    expect(res.statusCode).toBe(200);
    const rotated = RotateKeyResponse.parse(res.json());
    const [row] = await db.select().from(agents).where(eq(agents.id, created.agent.id));
    expect(row?.revokedAt).toBeNull();
    expect((await get("/v1/agents/me", `Bearer ${rotated.apiKey}`)).statusCode).toBe(200);
  });

  it("another owner's agent gets 404", async () => {
    const created = await create(await userAuth("me@test.local"));
    const res = await post(`/v1/agents/${created.agent.id}/rotate-key`, await userAuth("them@test.local"));
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("not_found");
    expect((await get("/v1/agents/me", `Bearer ${created.apiKey}`)).statusCode).toBe(200);
  });

  it("unknown agent gets 404", async () => {
    const res = await post("/v1/agents/agt_nope/rotate-key", await userAuth());
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("not_found");
  });
});

describe("DELETE /v1/agents/:id/key", () => {
  it("returns 204 with no body, then the key gets 401", async () => {
    const auth = await userAuth();
    const created = await create(auth);
    const res = await del(`/v1/agents/${created.agent.id}/key`, auth);
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe("");

    expect((await get("/v1/agents/me", `Bearer ${created.apiKey}`)).statusCode).toBe(401);
    const [row] = await db.select().from(agents).where(eq(agents.id, created.agent.id));
    expect(row?.apiKeyHash).toBeNull();
    expect(row?.apiKeyPrefix).toBeNull();
    expect(row?.revokedAt).toBeInstanceOf(Date);
  });

  it("another owner's agent gets 404 and the key keeps working", async () => {
    const created = await create(await userAuth("me@test.local"));
    const res = await del(`/v1/agents/${created.agent.id}/key`, await userAuth("them@test.local"));
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("not_found");
    expect((await get("/v1/agents/me", `Bearer ${created.apiKey}`)).statusCode).toBe(200);
  });

  it("works on an agent inserted directly (helper parity)", async () => {
    const auth = await userAuth();
    await get("/v1/agents", auth);
    const ownerId = await userId("owner@test.local");
    const { agentId, apiKey } = await createAgent(db, ownerId);
    expect((await del(`/v1/agents/${agentId}/key`, auth)).statusCode).toBe(204);
    expect((await get("/v1/agents/me", `Bearer ${apiKey}`)).statusCode).toBe(401);
  });
});

describe("OpenAPI", () => {
  it("lists all five identity routes", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/openapi.json" });
    const paths = res.json().paths as Record<string, Record<string, unknown>>;
    expect(Object.keys(paths["/v1/agents"] ?? {}).sort()).toEqual(["get", "post"]);
    expect(Object.keys(paths["/v1/agents/me"] ?? {})).toEqual(["get"]);
    expect(Object.keys(paths["/v1/agents/{id}/rotate-key"] ?? {})).toEqual(["post"]);
    expect(Object.keys(paths["/v1/agents/{id}/key"] ?? {})).toEqual(["delete"]);
  });
});
