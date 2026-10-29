// ui-01: agent names on spend requests, `today` on the agent list and GET /v1/wallet/activity.
import { AgentList, CreateSpendResponse, SpendRequestList, Wallet, WalletActivity } from "@gottaeat/schemas";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  buildTestApp,
  createAgent,
  createMandate,
  createTestBounty,
  createTestDb,
  createUserWithWallet,
  resetDb,
  signUserToken,
  topUp,
} from "../../../test/db";
import { agents, bounties, entries } from "../../db/schema";
import { newId } from "../../lib/ids";
import { creditTopup, holdWithdrawal, payBountyReward, refundStake, returnWithdrawal } from "../ledger";

const { db, pool } = createTestDb();
// Gate 2 stub "allow", so spends under the ask threshold settle at once.
const app = buildTestApp(db, { POLICY_GATE2_STUB: "allow" });

beforeAll(() => app.ready());
beforeEach(() => resetDb(db));
afterAll(async () => {
  await app.close();
  await pool.end();
});

let keyCounter = 0;
const newIdemKey = () => `ui-reads-key-${++keyCounter}-${Date.now()}`;

// createUser's email is `${id.toLowerCase()}@test.local`, so this token authenticates as that user.
async function authFor(userId: string) {
  return `Bearer ${await signUserToken({ email: `${userId.toLowerCase()}@test.local` })}`;
}
const agentAuth = (apiKey: string) => `Bearer ${apiKey}`;

const get = (url: string, authorization: string | null) =>
  app.inject({ method: "GET", url, headers: authorization ? { authorization } : {} });

async function spend(apiKey: string, payeeAgentId: string, amountCents: number) {
  const res = await app.inject({
    method: "POST",
    url: "/v1/spend-requests",
    headers: { authorization: agentAuth(apiKey), "idempotency-key": newIdemKey() },
    payload: { payeeAgentId, amountCents, category: "tool", reason: "Need the tool" },
  });
  expect(res.statusCode, res.body).toBe(201);
  return CreateSpendResponse.parse(res.json());
}

async function decide(ownerId: string, spendRequestId: string, decision: "approve" | "deny") {
  const res = await app.inject({
    method: "POST",
    url: `/v1/approvals/${spendRequestId}`,
    headers: { authorization: await authFor(ownerId), "idempotency-key": newIdemKey() },
    payload: { decision },
  });
  expect(res.statusCode, res.body).toBe(200);
}

const rename = (agentId: string, name: string) => db.update(agents).set({ name }).where(eq(agents.id, agentId));

// A spender named Sieve (askAboveCents $5) and a payee agent named Scout owned by someone else.
async function fixture(balanceCents = 5000n) {
  const ownerId = await createUserWithWallet(db);
  const payeeOwnerId = await createUserWithWallet(db);
  const { agentId, apiKey } = await createAgent(db, ownerId);
  const { agentId: payeeAgentId } = await createAgent(db, payeeOwnerId);
  await rename(agentId, "Sieve");
  await rename(payeeAgentId, "Scout");
  if (balanceCents > 0n) await topUp(db, ownerId, balanceCents);
  await createMandate(db, { agentId, createdBy: ownerId, rules: { askAboveCents: 500 } });
  return { ownerId, payeeOwnerId, agentId, payeeAgentId, apiKey };
}

async function activity(ownerId: string, query = "") {
  const res = await get(`/v1/wallet/activity${query}`, await authFor(ownerId));
  expect(res.statusCode, res.body).toBe(200);
  return WalletActivity.parse(res.json()).items;
}

describe("agent names on spend requests", () => {
  it("names the spender and a payee owned by another owner on approvals and the agent's list", async () => {
    const f = await fixture();
    const asked = await spend(f.apiKey, f.payeeAgentId, 800);
    expect(asked.status).toBe("pending_approval");

    const pending = await get("/v1/approvals", await authFor(f.ownerId));
    expect(pending.statusCode, pending.body).toBe(200);
    const [approval] = SpendRequestList.parse(pending.json()).spendRequests;
    expect(approval).toMatchObject({
      id: asked.id,
      agentId: f.agentId,
      agentName: "Sieve",
      payeeAgentId: f.payeeAgentId,
      payeeAgentName: "Scout",
    });

    const single = await get(`/v1/spend-requests/${asked.id}`, await authFor(f.ownerId));
    expect(single.json()).toMatchObject({ agentName: "Sieve", payeeAgentName: "Scout" });

    const list = await get(`/v1/agents/${f.agentId}/spend-requests`, await authFor(f.ownerId));
    expect(SpendRequestList.parse(list.json()).spendRequests[0]).toMatchObject({
      agentName: "Sieve",
      payeeAgentName: "Scout",
    });
  });

  it("gives a null payeeAgentName when there is no payee agent", async () => {
    const f = await fixture();
    const denied = await spend(f.apiKey, "agt_does_not_exist", 100);
    expect(denied.reasons).toContain("unknown_payee");

    const list = await get(`/v1/agents/${f.agentId}/spend-requests`, await authFor(f.ownerId));
    const [sr] = SpendRequestList.parse(list.json()).spendRequests;
    expect(sr).toMatchObject({ id: denied.id, agentName: "Sieve", payeeAgentId: null, payeeAgentName: null });
  });
});

describe("GET /v1/agents today", () => {
  it("matches the policy engine's daily spend and the confirmed mandate's cap", async () => {
    const f = await fixture();
    await spend(f.apiKey, f.payeeAgentId, 300); // settled
    await spend(f.apiKey, f.payeeAgentId, 800); // pending_approval, still counted

    const res = await get("/v1/agents", await authFor(f.ownerId));
    expect(res.statusCode, res.body).toBe(200);
    const sieve = AgentList.parse(res.json()).agents.find((a) => a.id === f.agentId);
    expect(sieve?.today).toEqual({ spentCents: 1100, dailyCapCents: 2000 });

    const wallet = Wallet.parse((await get("/v1/wallet", agentAuth(f.apiKey))).json());
    expect(wallet.agent?.todaySpentCents).toBe(sieve?.today?.spentCents);
  });

  it("gives a null cap without a confirmed mandate", async () => {
    const ownerId = await createUserWithWallet(db);
    const { agentId } = await createAgent(db, ownerId);
    const res = await get("/v1/agents", await authFor(ownerId));
    const [agent] = AgentList.parse(res.json()).agents;
    expect(agent).toMatchObject({ id: agentId, today: { spentCents: 0, dailyCapCents: null } });
  });
});

describe("GET /v1/wallet/activity", () => {
  it("lists a top-up, a settled spend, a hold and its release and a withdrawal, newest first and signed", async () => {
    const f = await fixture(0n);
    await db.transaction((tx) =>
      creditTopup(tx, {
        topupId: "tup_ui_reads",
        ownerId: f.ownerId,
        cents: 5000n,
        feeCents: 223n,
        idempotencyKey: "t1",
      }),
    );
    const settled = await spend(f.apiKey, f.payeeAgentId, 300);
    expect(settled.status).toBe("settled");
    const asked = await spend(f.apiKey, f.payeeAgentId, 800);
    await decide(f.ownerId, asked.id, "deny");
    const payoutId = "pay_ui_reads";
    await db.transaction((tx) =>
      holdWithdrawal(tx, { payoutId, ownerId: f.ownerId, cents: 1000n, idempotencyKey: "w1" }),
    );
    await db.transaction((tx) =>
      returnWithdrawal(tx, { payoutId, ownerId: f.ownerId, cents: 1000n, idempotencyKey: "w1-return" }),
    );

    const items = await activity(f.ownerId);
    expect(items.map((i) => [i.kind, i.amountCents, i.label, i.agentName])).toEqual([
      ["refund", 1000, "Withdrawal returned", null],
      ["withdrawal", -1000, "Withdrew to PayPal", null],
      ["release", 800, "Held money returned", "Sieve"],
      ["hold", -800, "Held for a tool purchase", "Sieve"],
      ["spend", -300, "Paid for a tool", "Sieve"],
      ["topup", 5000, "Added money from PayPal", null],
    ]);
    expect(items[4]).toMatchObject({ agentId: f.agentId, bountyId: null });
    // The signed amounts add up to the available balance.
    const wallet = Wallet.parse((await get("/v1/wallet", await authFor(f.ownerId))).json());
    expect(items.reduce((sum, i) => sum + i.amountCents, 0)).toBe(wallet.balanceCents);
    for (const i of items) expect(i.label).not.toMatch(/(agt|tup|pay|jnl|usr|spr)_/);

    // The payee's owner sees an earning by their agent and none of the spender's movements.
    const payeeItems = await activity(f.payeeOwnerId);
    expect(payeeItems.map((i) => [i.kind, i.amountCents, i.label, i.agentId, i.agentName])).toEqual([
      ["earning", 300, "Earned from a tool sale", f.payeeAgentId, "Scout"],
    ]);
  });

  it("reads a pending hold as a hold that becomes a spend once approved", async () => {
    const f = await fixture();
    const asked = await spend(f.apiKey, f.payeeAgentId, 800);
    expect((await activity(f.ownerId))[0]).toMatchObject({ kind: "hold", amountCents: -800 });
    await decide(f.ownerId, asked.id, "approve");
    expect((await activity(f.ownerId))[0]).toMatchObject({
      kind: "spend",
      amountCents: -800,
      label: "Paid for a tool",
    });
  });

  it("names the winning agent and bounty on a bounty reward and a stake refund", async () => {
    const posterId = await createUserWithWallet(db);
    const f = await fixture(0n);
    const bountyId = await createTestBounty(db, { posterId });
    const entryId = newId("ent");
    await db
      .insert(entries)
      .values({ id: entryId, bountyId, agentId: f.agentId, ownerId: f.ownerId, status: "submitted" });
    await db.update(bounties).set({ winnerEntryId: entryId }).where(eq(bounties.id, bountyId));
    await db.transaction(async (tx) => {
      await payBountyReward(tx, {
        bountyId,
        winnerOwnerId: f.ownerId,
        rewardCents: 5000n,
        feeCents: 500n,
        idempotencyKey: "reward",
      });
      await refundStake(tx, { bountyId, entryId, ownerId: f.ownerId, cents: 100n, idempotencyKey: "stake-refund" });
    });

    const items = await activity(f.ownerId);
    expect(items.map((i) => [i.kind, i.amountCents, i.label, i.agentName, i.bountyId]).sort()).toEqual(
      [
        ["earning", 5000, "Won a bounty", "Sieve", bountyId],
        ["refund", 100, "Stake returned", "Sieve", bountyId],
      ].sort(),
    );
    expect(await activity(posterId)).toEqual([]);
  });

  it("never shows another owner's movements", async () => {
    const mine = await createUserWithWallet(db);
    const theirs = await createUserWithWallet(db);
    await topUp(db, theirs, 700n);
    expect(await activity(mine)).toEqual([]);
    expect((await activity(theirs)).map((i) => i.amountCents)).toEqual([700]);
  });

  it("defaults to 50, honours limit and rejects limits outside 1-100", async () => {
    const ownerId = await createUserWithWallet(db);
    for (let i = 0; i < 51; i++) await topUp(db, ownerId, BigInt(i + 1));
    expect(await activity(ownerId)).toHaveLength(50);
    const two = await activity(ownerId, "?limit=2");
    expect(two.map((i) => i.amountCents)).toEqual([51, 50]);
    expect(await activity(ownerId, "?limit=100")).toHaveLength(51);
    const auth = await authFor(ownerId);
    for (const bad of ["0", "101", "1.5", "x"]) {
      expect((await get(`/v1/wallet/activity?limit=${bad}`, auth)).statusCode).toBe(400);
    }
  });

  it("requires a signed-in user", async () => {
    const f = await fixture();
    expect((await get("/v1/wallet/activity", null)).statusCode).toBe(401);
    expect((await get("/v1/wallet/activity", agentAuth(f.apiKey))).statusCode).toBe(403);
  });
});
