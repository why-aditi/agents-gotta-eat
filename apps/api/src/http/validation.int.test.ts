// UAT fixes: central input guards, framework error envelope, optional bodies, mandate coherence, bounty cap.
import { ErrorBody, MAX_BOUNTY_REWARD_CENTS } from "@gottaeat/schemas";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  bountyRequest,
  buildTestApp,
  createAgent,
  createMandate,
  createSpendFixture,
  createTestDb,
  createUser,
  createUserWithWallet,
  resetDb,
  signUserToken,
  TEST_JWT_SECRET,
  TEST_RULES,
} from "../../test/db";
import { buildApp } from "../app";
import { users } from "../db/schema";
import { toApiError } from "./errors";

const { db, pool } = createTestDb();
const app = buildTestApp(db, { ALLOW_DEV_CREDIT: "true", ALLOW_DEV_FUNDING: "true", POLICY_GATE2_STUB: "allow" });

beforeAll(() => app.ready());
beforeEach(() => resetDb(db));
afterAll(async () => {
  await app.close();
  await pool.end();
});

async function authFor(userId: string) {
  return `Bearer ${await signUserToken({ email: `${userId.toLowerCase()}@test.local` })}`;
}
let n = 0;
const key = () => `val-key-${++n}-${Date.now()}`;

function expectEnvelope(res: { statusCode: number; json: () => unknown }, status: number, code: string) {
  expect(res.statusCode).toBe(status);
  expect(ErrorBody.parse(res.json()).error.code).toBe(code);
}

describe("NUL and bad unicode", () => {
  it.each([
    ["NUL in agent name", { name: "bad\u0000name" }],
    ["lone surrogate in agent name", { name: "bad\ud800name" }],
    ["bidi override in agent name", { name: "evil‮gnp.exe" }],
    ["bidi isolate in agent name", { name: "a⁦b" }],
  ])("%s -> 400 validation_error", async (_n, body) => {
    const owner = await authFor(await createUser(db));
    const res = await app.inject({
      method: "POST",
      url: "/v1/agents",
      headers: { authorization: owner, "idempotency-key": key() },
      payload: body,
    });
    expectEnvelope(res, 400, "validation_error");
  });

  it("NUL in a mandate sourceText, bounty title and spend reason -> 400, not 500", async () => {
    const f = await createSpendFixture(db);
    const owner = await authFor(f.ownerId);
    const m = await app.inject({
      method: "PUT",
      url: `/v1/agents/${f.agentId}/mandate`,
      headers: { authorization: owner },
      payload: { sourceText: "a\u0000b", rules: TEST_RULES },
    });
    expectEnvelope(m, 400, "validation_error");
    const b = await app.inject({
      method: "POST",
      url: "/v1/bounties",
      headers: { authorization: owner, "idempotency-key": key() },
      payload: bountyRequest("creative_writing", { title: "t\u0000t" }),
    });
    expectEnvelope(b, 400, "validation_error");
    const { apiKey } = await createAgent(db, f.ownerId);
    const s = await app.inject({
      method: "POST",
      url: "/v1/spend-requests",
      headers: { authorization: `Bearer ${apiKey}`, "idempotency-key": key() },
      payload: { payeeAgentId: f.payeeAgentId, amountCents: 100, category: "tool", reason: "x\u0000y" },
    });
    expectEnvelope(s, 400, "validation_error");
  });

  it("NUL in a nested JSON value and an object key", async () => {
    const owner = await authFor(await createUser(db));
    const res = await app.inject({
      method: "POST",
      url: "/v1/bounties",
      headers: { authorization: owner, "idempotency-key": key() },
      payload: { ...bountyRequest("extract_data"), hidden: { answerKey: { "k\u0000": ["v\u0000"] } } },
    });
    expectEnvelope(res, 400, "validation_error");
  });

  it("NUL in a query string -> 400", async () => {
    const owner = await authFor(await createUser(db));
    const res = await app.inject({ method: "GET", url: "/v1/bounties?type=a%00b", headers: { authorization: owner } });
    expectEnvelope(res, 400, "validation_error");
  });

  it("an ordinary unicode name still works", async () => {
    const owner = await authFor(await createUser(db));
    const res = await app.inject({
      method: "POST",
      url: "/v1/agents",
      headers: { authorization: owner, "idempotency-key": key() },
      payload: { name: "Zoë 🍜 日本" },
    });
    expect(res.statusCode).toBe(201);
  });
});

describe("bounty reward cap", () => {
  it("rejects above the cap with a clear message, accepts the cap", async () => {
    const owner = await authFor(await createUserWithWallet(db));
    const over = await app.inject({
      method: "POST",
      url: "/v1/bounties",
      headers: { authorization: owner, "idempotency-key": key() },
      payload: bountyRequest("creative_writing", { rewardCents: MAX_BOUNTY_REWARD_CENTS + 1 }),
    });
    expectEnvelope(over, 400, "validation_error");
    expect(over.body).toMatch(/1000000|10,000/);
    const ok = await app.inject({
      method: "POST",
      url: "/v1/bounties",
      headers: { authorization: owner, "idempotency-key": key() },
      payload: bountyRequest("creative_writing", { rewardCents: MAX_BOUNTY_REWARD_CENTS }),
    });
    expect(ok.statusCode, ok.body).toBe(201);
  });
});

describe("mandate coherence", () => {
  const put = async (rules: object) => {
    const f = await createSpendFixture(db);
    return app.inject({
      method: "PUT",
      url: `/v1/agents/${f.agentId}/mandate`,
      headers: { authorization: await authFor(f.ownerId) },
      payload: { sourceText: "x", rules },
    });
  };

  it("askAboveCents > perTxMaxCents -> 400", async () => {
    const res = await put({ ...TEST_RULES, askAboveCents: 1500 });
    expectEnvelope(res, 400, "validation_error");
    expect(res.body).toMatch(/askAboveCents/);
  });
  it("perTxMaxCents > dailyMaxCents -> 400", async () => {
    const res = await put({ ...TEST_RULES, perTxMaxCents: 3000 });
    expectEnvelope(res, 400, "validation_error");
    expect(res.body).toMatch(/perTxMaxCents/);
  });
  it("expiresAt in the past -> 400", async () => {
    const res = await put({ ...TEST_RULES, expiresAt: "2020-01-01T00:00:00.000Z" });
    expectEnvelope(res, 400, "validation_error");
    expect(res.body).toMatch(/expiresAt/);
  });
  it("a coherent mandate with a future expiry is accepted", async () => {
    const res = await put({
      ...TEST_RULES,
      askAboveCents: 500,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(res.statusCode, res.body).toBe(201);
  });
});

describe("mandate confirm of a superseded version", () => {
  it("409 when a higher version is confirmed; confirming the active or a newer one is 200", async () => {
    const f = await createSpendFixture(db); // version 1 confirmed
    await createMandate(db, { agentId: f.agentId, createdBy: f.ownerId, version: 2 });
    await createMandate(db, { agentId: f.agentId, createdBy: f.ownerId, version: 3, confirmed: false });
    const owner = await authFor(f.ownerId);
    const url = `/v1/agents/${f.agentId}/mandate/confirm`;
    const confirm = (version: number) =>
      app.inject({ method: "POST", url, headers: { authorization: owner }, payload: { version } });
    const old = await confirm(1);
    expectEnvelope(old, 409, "invalid_transition");
    expect(old.body).toMatch(/version 2/);
    expect((await confirm(2)).statusCode).toBe(200);
    expect((await confirm(3)).statusCode).toBe(200);
  });
});

describe("framework errors use the envelope", () => {
  it("malformed URL -> 400 validation_error", async () => {
    expectEnvelope(await app.inject({ method: "GET", url: "/v1/agents/%ZZ" }), 400, "validation_error");
  });
  it("unknown route -> 404 not_found", async () => {
    expectEnvelope(await app.inject({ method: "GET", url: "/nope" }), 404, "not_found");
  });
  it("431 and 405 framework errors map to the envelope codes", () => {
    const e431 = toApiError(Object.assign(new Error("too large"), { code: "FST_ERR_X", statusCode: 431 }));
    expect(e431.status).toBe(431);
    const e405 = toApiError(Object.assign(new Error("nope"), { code: "FST_ERR_X", statusCode: 405 }));
    expect(e405.code).toBe("method_not_allowed");
    expect(e405.status).toBe(405);
  });
});

describe("compile 502 logging", () => {
  it("logs compile_failed at warn without a stack", async () => {
    const lines: string[] = [];
    const logged = buildApp({
      db,
      env: { API_JWT_SECRET: TEST_JWT_SECRET },
      logger: { level: "warn", stream: { write: (s: string) => void lines.push(s) } },
    });
    await logged.ready();
    const ownerId = await createUser(db);
    const { agentId } = await createAgent(db, ownerId);
    const res = await logged.inject({
      method: "POST",
      url: `/v1/agents/${agentId}/mandate/compile`,
      headers: { authorization: await authFor(ownerId) },
      payload: { sourceText: "Up to $5" },
    });
    await logged.close();
    expectEnvelope(res, 502, "compile_failed");
    const entries = lines.map((l) => JSON.parse(l) as { level: number; code?: string });
    expect(entries.find((e) => e.code === "compile_failed")?.level).toBe(40);
    expect(entries.some((e) => e.level >= 50)).toBe(false);
    expect(lines.join("")).not.toMatch(/stack/);
  });
});

describe("empty body with a JSON content type", () => {
  it("admin open route accepts it (no 'Body cannot be empty')", async () => {
    const admin = await createUserWithWallet(db);
    const owner = await authFor(admin);
    const created = await app.inject({
      method: "POST",
      url: "/v1/bounties",
      headers: { authorization: owner, "idempotency-key": key() },
      payload: bountyRequest("creative_writing"),
    });
    const id = created.json().id as string;
    await db
      .update(users)
      .set({ roles: ["admin"] })
      .where(eq(users.id, admin));
    const res = await app.inject({
      method: "POST",
      url: `/v1/admin/bounties/${id}/open`,
      headers: { authorization: owner, "idempotency-key": key(), "content-type": "application/json" },
    });
    expect(res.statusCode, res.body).toBe(200);
  });

  it("a route that needs a body still answers 400 validation_error for an empty one", async () => {
    const owner = await authFor(await createUser(db));
    const res = await app.inject({
      method: "POST",
      url: "/v1/agents",
      headers: { authorization: owner, "idempotency-key": key(), "content-type": "application/json" },
    });
    expectEnvelope(res, 400, "validation_error");
  });
});
