import {
  CreateAgentResponse,
  CreateSpendResponse,
  Mandate,
  type MandateRules,
  SpendRequest,
  SpendRequestList,
  Wallet,
} from "@gottaeat/schemas";
import type { LightMyRequestResponse } from "fastify";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  buildTestApp,
  createAgent,
  createSpendFixture,
  createUser,
  createUserWithWallet,
  createTestDb,
  resetDb,
  signUserToken,
  TEST_RULES,
  topUp,
} from "../../../test/db";
import { spendRequests, users } from "../../db/schema";
import { getBalances, reconcile } from "../ledger";

const { db, pool } = createTestDb();
// Defaults: dev credit off, gate 2 stub "ask".
const app = buildTestApp(db);
// Dev credit on, gate 2 stub "allow".
const devApp = buildTestApp(db, { ALLOW_DEV_CREDIT: "true", POLICY_GATE2_STUB: "allow" });
type TestApp = typeof app;

beforeAll(async () => {
  await app.ready();
  await devApp.ready();
});
beforeEach(() => resetDb(db));
afterAll(async () => {
  await app.close();
  await devApp.close();
  await pool.end();
});

let keyCounter = 0;
const newIdemKey = () => `routes-key-${++keyCounter}-${Date.now()}`;

// createUser's email is `${id.toLowerCase()}@test.local`, so this token authenticates as that user.
async function authFor(userId: string) {
  return `Bearer ${await signUserToken({ email: `${userId.toLowerCase()}@test.local` })}`;
}
const agentAuth = (apiKey: string) => `Bearer ${apiKey}`;

function send(
  a: TestApp,
  method: "GET" | "POST" | "PUT",
  url: string,
  authorization: string | null,
  body?: unknown,
  idempotencyKey: string | null = null,
) {
  return a.inject({
    method,
    url,
    headers: {
      ...(authorization ? { authorization } : {}),
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    },
    ...(body === undefined ? {} : { payload: body as Record<string, unknown> }),
  });
}
const get = (a: TestApp, url: string, auth: string | null) => send(a, "GET", url, auth);
const put = (a: TestApp, url: string, auth: string | null, body?: unknown) => send(a, "PUT", url, auth, body);
const postPlain = (a: TestApp, url: string, auth: string | null, body?: unknown) => send(a, "POST", url, auth, body);
const postIdem = (a: TestApp, url: string, auth: string | null, body?: unknown, key: string | null = newIdemKey()) =>
  send(a, "POST", url, auth, body, key);

function expectError(res: LightMyRequestResponse, status: number, code: string) {
  expect(res.statusCode, res.body).toBe(status);
  expect(res.json().error.code).toBe(code);
}

async function makeAdmin(userId: string) {
  await db
    .update(users)
    .set({ roles: ["admin"] })
    .where(eq(users.id, userId));
}

async function balances(ownerId: string) {
  const b = await getBalances(db, ownerId);
  return { balance: b.balanceCents, held: b.heldCents };
}

const spendBody = (payeeAgentId: string, amountCents = 100, category = "tool") => ({
  payeeAgentId,
  amountCents,
  category,
  reason: "Need the tool",
});

async function spend(a: TestApp, apiKey: string, body: unknown, key = newIdemKey()) {
  const res = await postIdem(a, "/v1/spend-requests", agentAuth(apiKey), body, key);
  expect(res.statusCode, res.body).toBe(201);
  return CreateSpendResponse.parse(res.json());
}

describe("happy path over HTTP", () => {
  it("registers agents, credits, sets a mandate, settles a tool spend, then approves one above askAboveCents", async () => {
    const ownerId = await createUser(db);
    const payeeOwnerId = await createUser(db);
    await makeAdmin(ownerId);
    const owner = await authFor(ownerId);
    const payeeOwner = await authFor(payeeOwnerId);

    const created = await postIdem(devApp, "/v1/agents", owner, { name: "Spender" });
    expect(created.statusCode).toBe(201);
    const spender = CreateAgentResponse.parse(created.json());
    const payeeRes = await postIdem(devApp, "/v1/agents", payeeOwner, { name: "Payee" });
    const payee = CreateAgentResponse.parse(payeeRes.json());

    const credit = await postIdem(devApp, `/v1/admin/wallets/${ownerId}/credit`, owner, { amountCents: 5000 });
    expect(credit.statusCode, credit.body).toBe(200);
    expect(Wallet.parse(credit.json())).toEqual({ ownerId, balanceCents: 5000, heldCents: 0 });

    const rules: MandateRules = { ...TEST_RULES, askAboveCents: 500 };
    const putRes = await put(devApp, `/v1/agents/${spender.agent.id}/mandate`, owner, {
      sourceText: "Up to $10 a tool, ask me above $5",
      rules,
    });
    expect(putRes.statusCode, putRes.body).toBe(201);
    const mandate = Mandate.parse(putRes.json());
    expect(mandate).toMatchObject({ agentId: spender.agent.id, version: 1, confirmedAt: null, rules });
    const confirmRes = await postPlain(devApp, `/v1/agents/${spender.agent.id}/mandate/confirm`, owner, {
      version: 1,
    });
    expect(confirmRes.statusCode, confirmRes.body).toBe(200);
    expect(Mandate.parse(confirmRes.json()).confirmedAt).not.toBeNull();

    const apiKey = spender.apiKey as string;
    const settled = await spend(devApp, apiKey, spendBody(payee.agent.id, 300));
    expect(settled).toMatchObject({ status: "settled", decision: "allow", reasons: [] });
    expect(await balances(ownerId)).toEqual({ balance: 4700n, held: 0n });
    expect(await balances(payeeOwnerId)).toEqual({ balance: 300n, held: 0n });

    const asked = await spend(devApp, apiKey, spendBody(payee.agent.id, 800));
    expect(asked).toMatchObject({ status: "pending_approval", decision: "pending_approval" });
    expect(asked.reasons).toEqual(["above_ask_threshold"]);
    expect(await balances(ownerId)).toEqual({ balance: 3900n, held: 800n });

    const pending = await get(devApp, "/v1/approvals?status=pending", owner);
    expect(pending.statusCode).toBe(200);
    const list = SpendRequestList.parse(pending.json());
    expect(list.spendRequests.map((s) => s.id)).toEqual([asked.id]);

    const approved = await postIdem(devApp, `/v1/approvals/${asked.id}`, owner, { decision: "approve" });
    expect(approved.statusCode, approved.body).toBe(200);
    const approvedDto = SpendRequest.parse(approved.json());
    expect(approvedDto.status).toBe("settled");
    expect(approvedDto.decisions.map((d) => [d.gate, d.verdict])).toEqual([
      ["hard_rules", "ask"],
      ["intent", "allow"],
      ["owner", "allow"],
    ]);
    expect(await balances(ownerId)).toEqual({ balance: 3900n, held: 0n });
    expect(await balances(payeeOwnerId)).toEqual({ balance: 1100n, held: 0n });

    const after = await get(devApp, "/v1/approvals", owner);
    expect(SpendRequestList.parse(after.json()).spendRequests).toEqual([]);

    const wallet = await get(devApp, "/v1/wallet", agentAuth(apiKey));
    expect(Wallet.parse(wallet.json())).toEqual({
      ownerId,
      balanceCents: 3900,
      heldCents: 0,
      agent: { agentId: spender.agent.id, todaySpentCents: 1100, limits: rules },
    });
    expect((await reconcile(db)).ok).toBe(true);
  });
});

describe("PUT /v1/agents/:id/mandate", () => {
  const body = { sourceText: "Tools only", rules: TEST_RULES };

  it("needs a user who owns the agent", async () => {
    const f = await createSpendFixture(db);
    const { apiKey } = await createAgent(db, f.ownerId);
    const url = `/v1/agents/${f.agentId}/mandate`;
    expectError(await put(app, url, null, body), 401, "unauthorized");
    expectError(await put(app, url, agentAuth(apiKey), body), 403, "forbidden");
    expectError(await put(app, url, await authFor(f.payeeOwnerId), body), 404, "not_found");
    expectError(await put(app, "/v1/agents/agt_unknown/mandate", await authFor(f.ownerId), body), 404, "not_found");
  });

  it("validates the body", async () => {
    const f = await createSpendFixture(db);
    const auth = await authFor(f.ownerId);
    const url = `/v1/agents/${f.agentId}/mandate`;
    expectError(await put(app, url, auth, { ...body, sourceText: " " }), 400, "validation_error");
    expectError(
      await put(app, url, auth, { ...body, rules: { ...TEST_RULES, perTxMaxCents: 10.5 } }),
      400,
      "validation_error",
    );
    expectError(
      await put(app, url, auth, { ...body, rules: { ...TEST_RULES, allowedCategories: [] } }),
      400,
      "validation_error",
    );
  });

  it("adds a new unconfirmed version each time", async () => {
    const f = await createSpendFixture(db);
    const auth = await authFor(f.ownerId);
    const url = `/v1/agents/${f.agentId}/mandate`;
    // The fixture inserted version 1.
    const second = await put(app, url, auth, body);
    expect(second.statusCode).toBe(201);
    expect(Mandate.parse(second.json())).toMatchObject({ version: 2, confirmedAt: null, sourceText: "Tools only" });
    const third = await put(app, url, auth, body);
    expect(Mandate.parse(third.json()).version).toBe(3);
  });
});

describe("POST /v1/agents/:id/mandate/confirm", () => {
  it("needs a user who owns the agent, a valid body and a known version", async () => {
    const f = await createSpendFixture(db);
    const { apiKey } = await createAgent(db, f.ownerId);
    const url = `/v1/agents/${f.agentId}/mandate/confirm`;
    const owner = await authFor(f.ownerId);
    expectError(await postPlain(app, url, null, { version: 1 }), 401, "unauthorized");
    expectError(await postPlain(app, url, agentAuth(apiKey), { version: 1 }), 403, "forbidden");
    expectError(await postPlain(app, url, owner, { version: 0 }), 400, "validation_error");
    expectError(await postPlain(app, url, owner, {}), 400, "validation_error");
    expectError(await postPlain(app, url, owner, { version: 9 }), 404, "not_found");
    expectError(await postPlain(app, url, await authFor(f.payeeOwnerId), { version: 1 }), 404, "not_found");
  });

  it("activates the version, which then shows as the agent's limits", async () => {
    const f = await createSpendFixture(db);
    const owner = await authFor(f.ownerId);
    const { apiKey, agentId: id } = await createAgent(db, f.ownerId);
    const rules = { ...TEST_RULES, perTxMaxCents: 42 };
    await put(app, `/v1/agents/${id}/mandate`, owner, { sourceText: "v1", rules });

    let wallet = Wallet.parse((await get(app, "/v1/wallet", agentAuth(apiKey))).json());
    expect(wallet.agent?.limits).toBeNull();

    const res = await postPlain(app, `/v1/agents/${id}/mandate/confirm`, owner, { version: 1 });
    expect(res.statusCode).toBe(200);
    expect(Mandate.parse(res.json())).toMatchObject({ agentId: id, version: 1, rules });
    wallet = Wallet.parse((await get(app, "/v1/wallet", agentAuth(apiKey))).json());
    expect(wallet.agent?.limits).toEqual(rules);
  });
});

describe("GET /v1/wallet", () => {
  it("needs credentials", async () => {
    expectError(await get(app, "/v1/wallet", null), 401, "unauthorized");
  });

  it("returns zeros for a user with no wallet yet", async () => {
    const res = await get(app, "/v1/wallet", `Bearer ${await signUserToken({ email: "fresh@test.local" })}`);
    expect(res.statusCode).toBe(200);
    const [user] = await db.select().from(users).where(eq(users.email, "fresh@test.local"));
    expect(res.json()).toEqual({ ownerId: user?.id, balanceCents: 0, heldCents: 0 });
  });

  it("shows an owner their wallet and an agent its owner's wallet plus its agent block", async () => {
    const f = await createSpendFixture(db, { balanceCents: 3000n });
    const { agentId, apiKey } = await createAgent(db, f.ownerId);
    // One settled tool spend by the new agent, which has a mandate of its own.
    await put(app, `/v1/agents/${agentId}/mandate`, await authFor(f.ownerId), {
      sourceText: "x",
      rules: TEST_RULES,
    });
    await postPlain(app, `/v1/agents/${agentId}/mandate/confirm`, await authFor(f.ownerId), { version: 1 });
    await spend(devApp, apiKey, spendBody(f.payeeAgentId, 250));

    const user = await get(app, "/v1/wallet", await authFor(f.ownerId));
    expect(user.json()).toEqual({ ownerId: f.ownerId, balanceCents: 2750, heldCents: 0 });

    const agent = await get(app, "/v1/wallet", agentAuth(apiKey));
    expect(agent.json()).toEqual({
      ownerId: f.ownerId,
      balanceCents: 2750,
      heldCents: 0,
      agent: { agentId, todaySpentCents: 250, limits: TEST_RULES },
    });

    // A new agent with no mandate: nothing spent, no limits.
    const { apiKey: noMandateKey, agentId: noMandateId } = await createAgent(db, f.ownerId);
    const other = Wallet.parse((await get(app, "/v1/wallet", agentAuth(noMandateKey))).json());
    expect(other.agent).toEqual({ agentId: noMandateId, todaySpentCents: 0, limits: null });
  });
});

describe("POST /v1/spend-requests", () => {
  it("needs an agent key", async () => {
    const f = await createSpendFixture(db, { balanceCents: 1000n });
    expectError(await postIdem(app, "/v1/spend-requests", null, spendBody(f.payeeAgentId)), 401, "unauthorized");
    expectError(
      await postIdem(app, "/v1/spend-requests", await authFor(f.ownerId), spendBody(f.payeeAgentId)),
      403,
      "forbidden",
    );
  });

  it("validates the body and the Idempotency-Key", async () => {
    const f = await createSpendFixture(db, { balanceCents: 1000n });
    const { apiKey } = await createAgent(db, f.ownerId);
    const auth = agentAuth(apiKey);
    for (const bad of [
      spendBody(f.payeeAgentId, 100, "stake"),
      spendBody(f.payeeAgentId, 0),
      spendBody(f.payeeAgentId, 1.5),
      { ...spendBody(f.payeeAgentId), reason: "" },
      { ...spendBody(f.payeeAgentId), reason: "x".repeat(501) },
      { amountCents: 100, category: "tool", reason: "no payee" },
    ]) {
      expectError(await postIdem(app, "/v1/spend-requests", auth, bad), 400, "validation_error");
    }
    expectError(
      await postIdem(app, "/v1/spend-requests", auth, spendBody(f.payeeAgentId), null),
      400,
      "idempotency_key_required",
    );
    expect(await db.select().from(spendRequests)).toEqual([]);
  });

  it("replays the first response without spending twice, and rejects a reused key with a new body", async () => {
    const f = await createSpendFixture(db, { balanceCents: 1000n });
    const { apiKey, agentId } = await createAgent(db, f.ownerId);
    const owner = await authFor(f.ownerId);
    await put(app, `/v1/agents/${agentId}/mandate`, owner, { sourceText: "x", rules: TEST_RULES });
    await postPlain(app, `/v1/agents/${agentId}/mandate/confirm`, owner, { version: 1 });

    const key = newIdemKey();
    const first = await postIdem(devApp, "/v1/spend-requests", agentAuth(apiKey), spendBody(f.payeeAgentId), key);
    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({ status: "settled" });
    const replay = await postIdem(devApp, "/v1/spend-requests", agentAuth(apiKey), spendBody(f.payeeAgentId), key);
    expect(replay.statusCode).toBe(201);
    expect(replay.headers["idempotent-replayed"]).toBe("true");
    expect(replay.json()).toEqual(first.json());
    expect(await balances(f.ownerId)).toEqual({ balance: 900n, held: 0n });
    expect(await balances(f.payeeOwnerId)).toEqual({ balance: 100n, held: 0n });
    expect(await db.select().from(spendRequests)).toHaveLength(1);

    expectError(
      await postIdem(devApp, "/v1/spend-requests", agentAuth(apiKey), spendBody(f.payeeAgentId, 200), key),
      422,
      "idempotency_key_reuse",
    );
  });

  it("returns gate denials as 201 with decision deny and reasons, holding nothing", async () => {
    const owner = await createUserWithWallet(db);
    await topUp(db, owner, 1000n);
    const payee = await createSpendFixture(db);
    const { apiKey } = await createAgent(db, owner);

    const noMandate = await spend(devApp, apiKey, spendBody(payee.payeeAgentId));
    expect(noMandate).toMatchObject({ status: "denied", decision: "deny", reasons: ["no_mandate"] });

    const f = await createSpendFixture(db, { balanceCents: 500n, rules: { perTxMaxCents: 100 } });
    const { apiKey: keyed, agentId: id } = await createAgent(db, f.ownerId);
    const auth = await authFor(f.ownerId);
    await put(app, `/v1/agents/${id}/mandate`, auth, {
      sourceText: "x",
      rules: { ...TEST_RULES, perTxMaxCents: 100 },
    });
    await postPlain(app, `/v1/agents/${id}/mandate/confirm`, auth, { version: 1 });
    const denied = await spend(devApp, keyed, spendBody(f.payeeAgentId, 600));
    expect(denied.decision).toBe("deny");
    expect(denied.reasons).toEqual(expect.arrayContaining(["over_per_tx", "insufficient_funds"]));
    expect(await balances(f.ownerId)).toEqual({ balance: 500n, held: 0n });
    expect(await balances(owner)).toEqual({ balance: 1000n, held: 0n });
  });

  it("sends a gate-1 allow to the owner by default (stub ask) and lets it through with POLICY_GATE2_STUB=allow", async () => {
    const f = await createSpendFixture(db, { balanceCents: 1000n });
    const { apiKey, agentId } = await createAgent(db, f.ownerId);
    const auth = await authFor(f.ownerId);
    await put(app, `/v1/agents/${agentId}/mandate`, auth, { sourceText: "x", rules: TEST_RULES });
    await postPlain(app, `/v1/agents/${agentId}/mandate/confirm`, auth, { version: 1 });

    const asked = await spend(app, apiKey, spendBody(f.payeeAgentId, 100));
    expect(asked).toMatchObject({ status: "pending_approval", decision: "pending_approval", reasons: ["intent_ask"] });
    expect(await balances(f.ownerId)).toEqual({ balance: 900n, held: 100n });

    const allowed = await spend(devApp, apiKey, spendBody(f.payeeAgentId, 100));
    expect(allowed).toMatchObject({ status: "settled", decision: "allow", reasons: [] });
    expect(await balances(f.ownerId)).toEqual({ balance: 800n, held: 100n });
  });
});

describe("GET /v1/spend-requests/:id", () => {
  it("shows a request to its agent and its owner only", async () => {
    const f = await createSpendFixture(db, { balanceCents: 1000n });
    const { apiKey, agentId } = await createAgent(db, f.ownerId);
    const { apiKey: siblingKey } = await createAgent(db, f.ownerId);
    const created = await spend(app, apiKey, spendBody(f.payeeAgentId)); // no mandate → denied
    const url = `/v1/spend-requests/${created.id}`;

    expectError(await get(app, url, null), 401, "unauthorized");
    const mine = await get(app, url, agentAuth(apiKey));
    expect(mine.statusCode).toBe(200);
    const dto = SpendRequest.parse(mine.json());
    expect(dto).toMatchObject({ id: created.id, agentId, status: "denied", amountCents: 100, feeCents: 0 });
    expect(dto.decisions.map((d) => d.gate)).toEqual(["hard_rules"]);

    const byOwner = await get(app, url, await authFor(f.ownerId));
    expect(byOwner.json()).toEqual(mine.json());

    expectError(await get(app, url, agentAuth(siblingKey)), 404, "not_found");
    expectError(await get(app, url, await authFor(f.payeeOwnerId)), 404, "not_found");
    expectError(await get(app, "/v1/spend-requests/spr_unknown", agentAuth(apiKey)), 404, "not_found");
    expectError(await get(app, `/v1/spend-requests/${"x".repeat(65)}`, agentAuth(apiKey)), 400, "validation_error");
  });
});

// A funded owner whose keyed agent has a confirmed mandate. Default app → every allowed spend asks.
async function pendingFixture(count = 1) {
  const f = await createSpendFixture(db, { balanceCents: 5000n });
  const { apiKey, agentId } = await createAgent(db, f.ownerId);
  const owner = await authFor(f.ownerId);
  await put(app, `/v1/agents/${agentId}/mandate`, owner, { sourceText: "x", rules: TEST_RULES });
  await postPlain(app, `/v1/agents/${agentId}/mandate/confirm`, owner, { version: 1 });
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const res = await spend(app, apiKey, spendBody(f.payeeAgentId, 100 * (i + 1)));
    expect(res.status).toBe("pending_approval");
    ids.push(res.id);
  }
  return { ...f, apiKey, keyedAgentId: agentId, owner, ids };
}

describe("GET /v1/approvals", () => {
  it("needs a user and only accepts status=pending", async () => {
    const f = await pendingFixture(0);
    expectError(await get(app, "/v1/approvals", null), 401, "unauthorized");
    expectError(await get(app, "/v1/approvals", agentAuth(f.apiKey)), 403, "forbidden");
    expectError(await get(app, "/v1/approvals?status=settled", f.owner), 400, "validation_error");
  });

  it("lists the owner's pending requests oldest first, and nothing for anyone else", async () => {
    const f = await pendingFixture(3);
    const res = await get(app, "/v1/approvals?status=pending", f.owner);
    expect(res.statusCode).toBe(200);
    expect(SpendRequestList.parse(res.json()).spendRequests.map((s) => s.id)).toEqual(f.ids);
    const other = await get(app, "/v1/approvals", await authFor(f.payeeOwnerId));
    expect(other.json()).toEqual({ spendRequests: [] });
  });
});

describe("POST /v1/approvals/:spendRequestId", () => {
  it("needs the owner, a valid body and an Idempotency-Key", async () => {
    const f = await pendingFixture(1);
    const url = `/v1/approvals/${f.ids[0]}`;
    expectError(await postIdem(app, url, null, { decision: "approve" }), 401, "unauthorized");
    expectError(await postIdem(app, url, agentAuth(f.apiKey), { decision: "approve" }), 403, "forbidden");
    expectError(await postIdem(app, url, f.owner, { decision: "maybe" }), 400, "validation_error");
    expectError(await postIdem(app, url, f.owner, { decision: "approve" }, null), 400, "idempotency_key_required");
    expectError(await postIdem(app, url, await authFor(f.payeeOwnerId), { decision: "approve" }), 404, "not_found");
    expectError(await postIdem(app, "/v1/approvals/spr_unknown", f.owner, { decision: "approve" }), 404, "not_found");
    expect(await balances(f.ownerId)).toEqual({ balance: 4900n, held: 100n });
  });

  it("approves once: a replay returns the same body without paying twice; a new key gets 409", async () => {
    const f = await pendingFixture(1);
    const url = `/v1/approvals/${f.ids[0]}`;
    const key = newIdemKey();
    const first = await postIdem(app, url, f.owner, { decision: "approve" }, key);
    expect(first.statusCode).toBe(200);
    expect(SpendRequest.parse(first.json()).status).toBe("settled");
    const replay = await postIdem(app, url, f.owner, { decision: "approve" }, key);
    expect(replay.statusCode).toBe(200);
    expect(replay.headers["idempotent-replayed"]).toBe("true");
    expect(replay.json()).toEqual(first.json());
    expect(await balances(f.ownerId)).toEqual({ balance: 4900n, held: 0n });
    expect(await balances(f.payeeOwnerId)).toEqual({ balance: 100n, held: 0n });

    expectError(await postIdem(app, url, f.owner, { decision: "deny" }), 409, "already_decided");
    expect((await reconcile(db)).ok).toBe(true);
  });

  it("deny releases the hold", async () => {
    const f = await pendingFixture(1);
    const res = await postIdem(app, `/v1/approvals/${f.ids[0]}`, f.owner, { decision: "deny" });
    expect(res.statusCode).toBe(200);
    const dto = SpendRequest.parse(res.json());
    expect(dto.status).toBe("released");
    expect(dto.decisions.at(-1)).toMatchObject({ gate: "owner", verdict: "deny" });
    expect(await balances(f.ownerId)).toEqual({ balance: 5000n, held: 0n });
  });
});

describe("GET /v1/agents/:id/spend-requests", () => {
  it("needs the owning user", async () => {
    const f = await pendingFixture(0);
    const url = `/v1/agents/${f.keyedAgentId}/spend-requests`;
    expectError(await get(app, url, null), 401, "unauthorized");
    expectError(await get(app, url, agentAuth(f.apiKey)), 403, "forbidden");
    expectError(await get(app, url, await authFor(f.payeeOwnerId)), 404, "not_found");
    expectError(await get(app, `/v1/agents/${"x".repeat(65)}/spend-requests`, f.owner), 400, "validation_error");
  });

  it("lists the agent's requests newest first with their decisions", async () => {
    const f = await pendingFixture(2);
    const denied = await spend(app, f.apiKey, spendBody(f.payeeAgentId, 5000)); // over per-tx
    const res = await get(app, `/v1/agents/${f.keyedAgentId}/spend-requests`, f.owner);
    expect(res.statusCode).toBe(200);
    const list = SpendRequestList.parse(res.json()).spendRequests;
    expect(list.map((s) => s.id)).toEqual([denied.id, f.ids[1], f.ids[0]]);
    expect(list.map((s) => s.status)).toEqual(["denied", "pending_approval", "pending_approval"]);
    expect(list[0]?.decisions.map((d) => [d.gate, d.verdict])).toEqual([["hard_rules", "deny"]]);
    expect(list[1]?.decisions.map((d) => [d.gate, d.verdict])).toEqual([
      ["hard_rules", "allow"],
      ["intent", "ask"],
    ]);
  });
});

describe("POST /v1/admin/wallets/:userId/credit", () => {
  it("is absent (404) unless ALLOW_DEV_CREDIT=true, even for admins and bad bodies", async () => {
    const adminId = await createUser(db);
    await makeAdmin(adminId);
    const auth = await authFor(adminId);
    const url = `/v1/admin/wallets/${adminId}/credit`;
    expectError(await postIdem(app, url, auth, { amountCents: 100 }), 404, "not_found");
    expectError(await postIdem(app, url, auth, { amountCents: -1 }), 404, "not_found");
    expectError(await postIdem(app, url, auth, { amountCents: 100 }, null), 404, "not_found");
    expect(await balances(adminId)).toEqual({ balance: 0n, held: 0n });
  });

  it("needs an admin user, a valid body, a key and a known target", async () => {
    const adminId = await createUser(db);
    const userId = await createUserWithWallet(db);
    const { apiKey } = await createAgent(db, userId);
    const url = `/v1/admin/wallets/${userId}/credit`;
    expectError(await postIdem(devApp, url, null, { amountCents: 100 }), 401, "unauthorized");
    expectError(await postIdem(devApp, url, agentAuth(apiKey), { amountCents: 100 }), 403, "forbidden");
    expectError(await postIdem(devApp, url, await authFor(userId), { amountCents: 100 }), 403, "forbidden");
    expectError(await postIdem(devApp, url, await authFor(adminId), { amountCents: 100 }), 403, "forbidden");

    await makeAdmin(adminId);
    const admin = await authFor(adminId);
    expectError(await postIdem(devApp, url, admin, { amountCents: 0 }), 400, "validation_error");
    expectError(await postIdem(devApp, url, admin, { amountCents: 1.5 }), 400, "validation_error");
    expectError(await postIdem(devApp, url, admin, { amountCents: 100 }, null), 400, "idempotency_key_required");
    expectError(
      await postIdem(devApp, "/v1/admin/wallets/usr_unknown/credit", admin, { amountCents: 100 }),
      404,
      "not_found",
    );
    expect(await balances(userId)).toEqual({ balance: 0n, held: 0n });
  });

  it("credits once per key, opening the wallet if needed", async () => {
    const adminId = await createUser(db);
    await makeAdmin(adminId);
    const admin = await authFor(adminId);
    const userId = await createUser(db); // no wallet yet
    const url = `/v1/admin/wallets/${userId}/credit`;
    const key = newIdemKey();
    const first = await postIdem(devApp, url, admin, { amountCents: 2500 }, key);
    expect(first.statusCode, first.body).toBe(200);
    expect(first.json()).toEqual({ ownerId: userId, balanceCents: 2500, heldCents: 0 });
    const replay = await postIdem(devApp, url, admin, { amountCents: 2500 }, key);
    expect(replay.headers["idempotent-replayed"]).toBe("true");
    expect(replay.json()).toEqual(first.json());
    expect(await balances(userId)).toEqual({ balance: 2500n, held: 0n });

    const second = await postIdem(devApp, url, admin, { amountCents: 500 });
    expect(second.json()).toEqual({ ownerId: userId, balanceCents: 3000, heldCents: 0 });
    expect((await reconcile(db)).ok).toBe(true);
  });
});
