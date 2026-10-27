// POST /v1/agent-runs, the log_run_step MCP tool, and the 30-day prune.
import { ArenaEvent, CreateAgentRunResponse, McpTools } from "@gottaeat/schemas";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  buildTestApp,
  createAgent,
  createTestBounty,
  createTestDb,
  createUserWithWallet,
  resetDb,
  signUserToken,
} from "../../../test/db";
import { agentRuns, events, paypalCalls } from "../../db/schema";
import { callTool } from "../mcp";
import { createAgentRun, pruneEvents, publish, RETENTION_MS, toArenaEvent } from "./index";

const { db, pool } = createTestDb();
const app = buildTestApp(db);
beforeAll(() => app.ready());
beforeEach(() => resetDb(db));
afterAll(async () => {
  await app.close();
  await pool.end();
});

async function fixture() {
  const ownerId = await createUserWithWallet(db);
  const { agentId, apiKey } = await createAgent(db, ownerId);
  const bountyId = await createTestBounty(db, { posterId: ownerId });
  return { ownerId, agentId, apiKey, bountyId };
}

const post = (auth: string, body: unknown, headers: Record<string, string> = {}) =>
  app.inject({
    method: "POST",
    url: "/v1/agent-runs",
    headers: { authorization: auth, ...headers },
    payload: body as Record<string, unknown>,
  });

async function storedEvents(): Promise<ArenaEvent[]> {
  const rows = await db.select().from(events).orderBy(asc(events.id));
  return rows.map((r) => ArenaEvent.parse(toArenaEvent(r)));
}

describe("POST /v1/agent-runs", () => {
  it("201: stores the step and publishes a public agent.run_step with the summary only", async () => {
    const f = await fixture();
    const res = await post(`Bearer ${f.apiKey}`, {
      bountyId: f.bountyId,
      step: "enter_decision",
      tool: "decide_enter",
      summary: "Enter: EV $14.50, 60% win chance",
      input: "secret-ish input",
      output: "raw output",
      tokens: 12,
      latencyMs: 34,
    });
    expect(res.statusCode).toBe(201);
    const { id } = CreateAgentRunResponse.parse(res.json());
    expect(id).toMatch(/^run_/);

    const [row] = await db.select().from(agentRuns).where(eq(agentRuns.id, id));
    expect(row).toMatchObject({
      agentId: f.agentId,
      bountyId: f.bountyId,
      step: "enter_decision",
      tool: "decide_enter",
      input: "secret-ish input",
      output: "raw output",
      tokens: 12,
      latencyMs: 34,
    });
    const evs = await storedEvents();
    expect(evs).toMatchObject([
      {
        type: "agent.run_step",
        scope: "public",
        ownerId: null,
        bountyId: f.bountyId,
        data: {
          runId: id,
          agentId: f.agentId,
          agentName: "Test agent",
          bountyId: f.bountyId,
          bountyTitle: "Test extract_data bounty",
          step: "enter_decision",
          summary: "Enter: EV $14.50, 60% win chance",
        },
      },
    ]);
    expect(JSON.stringify(evs)).not.toContain("secret-ish");
  });

  it("works without a bounty", async () => {
    const f = await fixture();
    const res = await post(`Bearer ${f.apiKey}`, { step: "stop", summary: "Stopped: budget" });
    expect(res.statusCode).toBe(201);
    expect((await storedEvents())[0]).toMatchObject({ bountyId: null, data: { bountyId: null, bountyTitle: null } });
  });

  it("validates step, summary length and the 4 KB caps", async () => {
    const f = await fixture();
    const auth = `Bearer ${f.apiKey}`;
    const bad = [
      { step: "dance", summary: "x" },
      { step: "plan", summary: "" },
      { step: "plan", summary: "x".repeat(281) },
      { step: "plan", summary: "x", input: "x".repeat(4097) },
      { step: "plan", summary: "x", output: "é".repeat(2049) },
      { step: "plan", summary: "x", tokens: -1 },
      { step: "plan", summary: "x", latencyMs: 1.5 },
    ];
    for (const body of bad) {
      const res = await post(auth, body);
      expect(res.statusCode, JSON.stringify(body).slice(0, 80)).toBe(400);
    }
    expect((await post(auth, { step: "plan", summary: "x".repeat(280), input: "x".repeat(4096) })).statusCode).toBe(
      201,
    );
    expect(await db.select().from(agentRuns)).toHaveLength(1);
  });

  it("404 for an unknown or draft bounty", async () => {
    const f = await fixture();
    const draft = await createTestBounty(db, { posterId: f.ownerId, status: "draft" });
    for (const bountyId of ["bty_nope", draft]) {
      const res = await post(`Bearer ${f.apiKey}`, { bountyId, step: "plan", summary: "x" });
      expect(res.statusCode).toBe(404);
    }
    expect(await storedEvents()).toEqual([]);
  });

  it("403 for a user token, 401 without credentials", async () => {
    const f = await fixture();
    const token = await signUserToken({ email: `${f.ownerId.toLowerCase()}@test.local` });
    expect((await post(`Bearer ${token}`, { step: "plan", summary: "x" })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/v1/agent-runs", payload: {} })).statusCode).toBe(401);
  });

  it("the 61st step in a minute is 429 rate_limited; other agents are unaffected", async () => {
    const f = await fixture();
    const now = new Date();
    const principal = { type: "agent" as const, agentId: f.agentId, ownerId: f.ownerId };
    for (let i = 0; i < 60; i++) await createAgentRun(db, principal, { step: "work", summary: `step ${i}` }, now);
    const res = await post(`Bearer ${f.apiKey}`, { step: "work", summary: "one too many" });
    expect(res.statusCode).toBe(429);
    expect(res.json()).toMatchObject({ error: { code: "rate_limited", detail: { limit: 60, windowSeconds: 60 } } });
    expect(await db.select().from(agentRuns)).toHaveLength(60);

    const other = await createAgent(db, f.ownerId);
    expect((await post(`Bearer ${other.apiKey}`, { step: "work", summary: "fine" })).statusCode).toBe(201);
    // A minute later the window has moved on.
    await createAgentRun(db, principal, { step: "work", summary: "later" }, new Date(now.getTime() + 61_000));
  });

  it("an Idempotency-Key replays the first response; a 429 is not stored", async () => {
    const f = await fixture();
    const auth = `Bearer ${f.apiKey}`;
    const first = await post(auth, { step: "plan", summary: "x" }, { "idempotency-key": "run-1" });
    const again = await post(auth, { step: "plan", summary: "x" }, { "idempotency-key": "run-1" });
    expect(again.statusCode).toBe(201);
    expect(again.headers["idempotent-replayed"]).toBe("true");
    expect(again.json()).toEqual(first.json());
    expect(await db.select().from(agentRuns)).toHaveLength(1);

    const principal = { type: "agent" as const, agentId: f.agentId, ownerId: f.ownerId };
    for (let i = 0; i < 59; i++) await createAgentRun(db, principal, { step: "work", summary: "s" });
    const limited = await post(auth, { step: "plan", summary: "y" }, { "idempotency-key": "run-2" });
    expect(limited.statusCode).toBe(429);
    const retried = await post(auth, { step: "plan", summary: "y" }, { "idempotency-key": "run-2" });
    expect(retried.statusCode).toBe(429);
    expect(retried.headers["idempotent-replayed"]).toBeUndefined();
  });
});

describe("log_run_step (MCP)", () => {
  it("maps to POST /v1/agent-runs", async () => {
    const f = await fixture();
    const tool = McpTools.find((t) => t.name === "log_run_step")!;
    const result = await callTool(app, tool, `Bearer ${f.apiKey}`, {
      bountyId: f.bountyId,
      step: "submit",
      summary: "Submitted",
    });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({ id: expect.stringMatching(/^run_/) });
    expect((await storedEvents())[0]).toMatchObject({ type: "agent.run_step", data: { step: "submit" } });
  });
});

describe("pruneEvents", () => {
  it("deletes events and agent runs older than 30 days and keeps the rest", async () => {
    const f = await fixture();
    const now = new Date();
    const old = new Date(now.getTime() - RETENTION_MS - 60_000);
    const recent = new Date(now.getTime() - RETENTION_MS + 60_000);
    const principal = { type: "agent" as const, agentId: f.agentId, ownerId: f.ownerId };
    const oldRun = await createAgentRun(db, principal, { step: "plan", summary: "old" }, old);
    const newRun = await createAgentRun(db, principal, { step: "plan", summary: "new" }, recent);
    // Run events carry the database's now(); add an old event alongside them.
    await db.insert(events).values({
      type: "bounty.judging",
      scope: "public",
      bountyId: null,
      data: { bountyId: "b", title: "T" },
      createdAt: old,
    });
    await publish(db, { type: "bounty.judging", bountyId: null, data: { bountyId: "b", title: "kept" } });
    // The PayPal call log is pruned with them.
    await db.insert(paypalCalls).values([
      { method: "GET", path: "/old", durationMs: 1, source: "client", createdAt: old },
      { method: "GET", path: "/new", durationMs: 1, source: "client", createdAt: recent },
    ]);

    expect(await pruneEvents(db, now)).toEqual({ events: 1, agentRuns: 1, paypalCalls: 1 });
    expect((await db.select({ path: paypalCalls.path }).from(paypalCalls)).map((c) => c.path)).toEqual(["/new"]);
    const runs = await db.select({ id: agentRuns.id }).from(agentRuns);
    expect(runs.map((r) => r.id)).toEqual([newRun.id]);
    expect(runs.map((r) => r.id)).not.toContain(oldRun.id);
    expect(await db.select().from(events)).toHaveLength(3);
  });
});
