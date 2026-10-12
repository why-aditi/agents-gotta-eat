import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { buildTestApp, createAgent, createTestDb, createUser, resetDb, signUserToken } from "../../test/db";
import { idempotencyKeys } from "../db/schema";
import { requestHash } from "./idempotency";

const { db, pool } = createTestDb();
const app = buildTestApp(db);

let echoCalls = 0;
let failNext = 0;
app.post(
  "/v1/_test/echo",
  {
    config: { auth: "any", idempotent: true },
    schema: { body: z.object({ msg: z.string(), delayMs: z.int().optional(), status: z.int().optional() }) },
  },
  async (req, reply) => {
    echoCalls++;
    const body = req.body as { msg: string; delayMs?: number; status?: number };
    if (body.delayMs) await new Promise((r) => setTimeout(r, body.delayMs));
    if (failNext > 0) {
      failNext--;
      throw new Error("handler blew up");
    }
    return reply.code(body.status ?? 201).send({ msg: body.msg, call: echoCalls });
  },
);

let secretCalls = 0;
app.post(
  "/v1/_test/secret",
  {
    config: {
      auth: "user",
      idempotent: true,
      redactForReplay: (body) => ({ ...(body as object), secret: null }),
    },
  },
  async (_req, reply) => {
    secretCalls++;
    return reply.code(201).send({ id: "thing_1", secret: `s3cret-${secretCalls}` });
  },
);

let userToken: string;

beforeAll(() => app.ready());
beforeEach(async () => {
  await resetDb(db);
  echoCalls = 0;
  secretCalls = 0;
  failNext = 0;
  userToken = await signUserToken({ email: "poster@test.local" });
});
afterAll(async () => {
  await app.close();
  await pool.end();
});

function post(url: string, payload: unknown, opts: { key?: string; token?: string } = {}) {
  const headers: Record<string, string> = { authorization: `Bearer ${opts.token ?? userToken}` };
  if (opts.key !== undefined) headers["idempotency-key"] = opts.key;
  return app.inject({ method: "POST", url, headers, payload: payload as object });
}

describe("idempotency", () => {
  it("missing or malformed key → 400 idempotency_key_required, handler not run", async () => {
    for (const key of [undefined, "", "x".repeat(256), "tab\there", "ünicode"]) {
      const res = await post("/v1/_test/echo", { msg: "hi" }, { key });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("idempotency_key_required");
    }
    expect(echoCalls).toBe(0);
  });

  it("replay returns the same status and body with Idempotent-Replayed, and the handler ran once", async () => {
    const first = await post("/v1/_test/echo", { msg: "hi" }, { key: "k1" });
    expect(first.statusCode).toBe(201);
    expect(first.headers["idempotent-replayed"]).toBeUndefined();

    // Same JSON with keys in another order is the same request.
    const second = await app.inject({
      method: "POST",
      url: "/v1/_test/echo",
      headers: { authorization: `Bearer ${userToken}`, "idempotency-key": "k1", "content-type": "application/json" },
      payload: '{ "msg": "hi" }',
    });
    expect(second.statusCode).toBe(201);
    expect(second.headers["idempotent-replayed"]).toBe("true");
    expect(second.json()).toEqual(first.json());
    expect(echoCalls).toBe(1);
  });

  it("4xx responses are stored and replayed", async () => {
    const first = await post("/v1/_test/echo", { msg: "no", status: 409 }, { key: "k4xx" });
    expect(first.statusCode).toBe(409);
    const second = await post("/v1/_test/echo", { msg: "no", status: 409 }, { key: "k4xx" });
    expect(second.statusCode).toBe(409);
    expect(second.headers["idempotent-replayed"]).toBe("true");
    expect(echoCalls).toBe(1);
  });

  it("same key with a different body → 422 idempotency_key_reuse", async () => {
    await post("/v1/_test/echo", { msg: "hi" }, { key: "k2" });
    const res = await post("/v1/_test/echo", { msg: "different" }, { key: "k2" });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe("idempotency_key_reuse");
    expect(echoCalls).toBe(1);
  });

  it("two concurrent same-key requests → one 2xx and one 409", async () => {
    const [a, b] = await Promise.all([
      post("/v1/_test/echo", { msg: "race", delayMs: 300 }, { key: "k3" }),
      post("/v1/_test/echo", { msg: "race", delayMs: 300 }, { key: "k3" }),
    ]);
    const statuses = [a.statusCode, b.statusCode].sort();
    expect(statuses).toEqual([201, 409]);
    const conflict = a.statusCode === 409 ? a : b;
    expect(conflict.json().error.code).toBe("idempotency_in_progress");
    expect(echoCalls).toBe(1);
  });

  it("a handler 500 frees the key so a retry runs", async () => {
    failNext = 1;
    const first = await post("/v1/_test/echo", { msg: "retry" }, { key: "k5" });
    expect(first.statusCode).toBe(500);
    const rows = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, "k5"));
    expect(rows).toHaveLength(0);

    const second = await post("/v1/_test/echo", { msg: "retry" }, { key: "k5" });
    expect(second.statusCode).toBe(201);
    expect(second.headers["idempotent-replayed"]).toBeUndefined();
    expect(echoCalls).toBe(2);
  });

  it("the same key from two principals runs for both", async () => {
    const owner = await createUser(db);
    const { apiKey } = await createAgent(db, owner);
    const asUser = await post("/v1/_test/echo", { msg: "shared" }, { key: "k6" });
    const asAgent = await post("/v1/_test/echo", { msg: "shared" }, { key: "k6", token: apiKey });
    const asOtherUser = await post(
      "/v1/_test/echo",
      { msg: "shared" },
      { key: "k6", token: await signUserToken({ email: "other@test.local" }) },
    );
    for (const res of [asUser, asAgent, asOtherUser]) {
      expect(res.statusCode).toBe(201);
      expect(res.headers["idempotent-replayed"]).toBeUndefined();
    }
    expect(echoCalls).toBe(3);
  });

  it("a 25-hour-old row is overwritten", async () => {
    const first = await post("/v1/_test/echo", { msg: "old" }, { key: "k7" });
    expect(first.statusCode).toBe(201);
    const [row] = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, "k7"));
    await db
      .update(idempotencyKeys)
      .set({ createdAt: sql`now() - interval '25 hours'` })
      .where(and(eq(idempotencyKeys.principal, row!.principal), eq(idempotencyKeys.key, "k7")));

    // A different body would be 422 for a live key; an expired one is simply reused.
    const res = await post("/v1/_test/echo", { msg: "new" }, { key: "k7" });
    expect(res.statusCode).toBe(201);
    expect(res.headers["idempotent-replayed"]).toBeUndefined();
    expect(res.json().msg).toBe("new");
    expect(echoCalls).toBe(2);

    const [after] = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, "k7"));
    expect(after?.status).toBe("done");
    expect(after?.requestHash).toBe(requestHash("POST", "/v1/_test/echo", { msg: "new" }));
    expect((Date.now() - after!.createdAt.getTime()) / 3_600_000).toBeLessThan(1);
  });

  it("a stuck in_progress row older than 24 h is overwritten too", async () => {
    const owner = await createUser(db);
    const { agentId, apiKey } = await createAgent(db, owner);
    await db.insert(idempotencyKeys).values({
      principal: `agent:${agentId}`,
      key: "k8",
      method: "POST",
      path: "/v1/_test/echo",
      requestHash: "stale",
      status: "in_progress",
      createdAt: new Date(Date.now() - 25 * 3_600_000),
    });
    const res = await post("/v1/_test/echo", { msg: "fresh" }, { key: "k8", token: apiKey });
    expect(res.statusCode).toBe(201);
  });

  it("redaction applies to the stored copy only", async () => {
    const first = await post("/v1/_test/secret", undefined, { key: "k9" });
    expect(first.statusCode).toBe(201);
    expect(first.json()).toEqual({ id: "thing_1", secret: "s3cret-1" });

    const [row] = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, "k9"));
    expect(row?.responseBody).toEqual({ id: "thing_1", secret: null });

    const replay = await post("/v1/_test/secret", undefined, { key: "k9" });
    expect(replay.statusCode).toBe(201);
    expect(replay.headers["idempotent-replayed"]).toBe("true");
    expect(replay.json()).toEqual({ id: "thing_1", secret: null });
    expect(secretCalls).toBe(1);
  });

  it("validation and auth failures do not take the key", async () => {
    const bad = await post("/v1/_test/echo", { nope: true }, { key: "k10" });
    expect(bad.statusCode).toBe(400);
    const unauth = await app.inject({
      method: "POST",
      url: "/v1/_test/echo",
      headers: { "idempotency-key": "k10" },
      payload: { msg: "x" },
    });
    expect(unauth.statusCode).toBe(401);
    const ok = await post("/v1/_test/echo", { msg: "x" }, { key: "k10" });
    expect(ok.statusCode).toBe(201);
  });
});
