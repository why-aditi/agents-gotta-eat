// /v1/subcontracts, /v1/agents/search and PATCH /v1/agents/:id over HTTP: auth, idempotency, outcomes and filters.
import { AgentSearchList, CreateSubcontractResponse, Subcontract, SubcontractList } from "@gottaeat/schemas";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  buildTestApp,
  createAgent,
  createMandate,
  createTestDb,
  createUserWithWallet,
  resetDb,
  signUserToken,
  topUp,
} from "../../../test/db";
import { agents } from "../../db/schema";
import { getBalances, reconcile } from "../ledger";

const { db, pool } = createTestDb();
const app = buildTestApp(db, { POLICY_GATE2_STUB: "allow" });

beforeAll(() => app.ready());
beforeEach(() => resetDb(db));
afterAll(async () => {
  await app.close();
  await pool.end();
});

let n = 0;
const key = () => `sub-routes-${++n}-${Date.now()}`;
const bearer = (k: string) => `Bearer ${k}`;
const userAuth = async (userId: string) => bearer(await signUserToken({ email: `${userId.toLowerCase()}@test.local` }));

async function call(
  method: "GET" | "POST" | "PATCH",
  url: string,
  authorization: string,
  opts: { body?: unknown; idem?: string | null } = {},
) {
  const idem = opts.idem === undefined && method === "POST" ? key() : opts.idem;
  return app.inject({
    method,
    url,
    headers: { authorization, ...(idem ? { "idempotency-key": idem } : {}) },
    ...(opts.body !== undefined ? { payload: opts.body as object } : {}),
  });
}

async function setup() {
  const hirerOwner = await createUserWithWallet(db);
  const workerOwner = await createUserWithWallet(db);
  const hirer = await createAgent(db, hirerOwner);
  const worker = await createAgent(db, workerOwner);
  await topUp(db, hirerOwner, 5000n);
  await createMandate(db, { agentId: hirer.agentId, createdBy: hirerOwner });
  return { hirerOwner, workerOwner, hirer, worker };
}

type S = Awaited<ReturnType<typeof setup>>;
const hireBody = (s: S, over: object = {}) => ({
  workerAgentId: s.worker.agentId,
  task: "Summarise <i>these</i> notes",
  amountCents: 300,
  reason: "Faster with help",
  ...over,
});

async function hireOpen(s: S) {
  const res = await call("POST", "/v1/subcontracts", bearer(s.hirer.apiKey), { body: hireBody(s) });
  expect(res.statusCode).toBe(201);
  const body = CreateSubcontractResponse.parse(res.json());
  if (!body.subcontract) throw new Error("not hired");
  return body.subcontract;
}

describe("POST /v1/subcontracts", () => {
  it("needs an agent key and an Idempotency-Key, and replays the first response", async () => {
    const s = await setup();
    const noKey = await call("POST", "/v1/subcontracts", bearer(s.hirer.apiKey), { body: hireBody(s), idem: null });
    expect(noKey.statusCode).toBe(400);
    expect(noKey.json().error.code).toBe("idempotency_key_required");
    const asUser = await call("POST", "/v1/subcontracts", await userAuth(s.hirerOwner), { body: hireBody(s) });
    expect(asUser.statusCode).toBe(403);

    const idem = key();
    const first = await call("POST", "/v1/subcontracts", bearer(s.hirer.apiKey), { body: hireBody(s), idem });
    const again = await call("POST", "/v1/subcontracts", bearer(s.hirer.apiKey), { body: hireBody(s), idem });
    expect(first.statusCode).toBe(201);
    expect(again.statusCode).toBe(201);
    expect(again.json()).toEqual(first.json());
    expect(first.json().subcontract.status).toBe("open");
    // One hold of $3.00 + 6¢.
    expect(await getBalances(db, s.hirerOwner)).toEqual({ balanceCents: 4694n, heldCents: 306n });
  });

  it("answers 201 with no subcontract on a policy deny, and 422 for self-hire", async () => {
    const s = await setup();
    const deny = await call("POST", "/v1/subcontracts", bearer(s.hirer.apiKey), {
      body: hireBody(s, { amountCents: 1500 }),
    });
    expect(deny.statusCode).toBe(201);
    expect(deny.json()).toMatchObject({ subcontract: null, spend: { decision: "deny" } });
    expect(deny.json().spend.reasons).toContain("over_per_tx");

    const self = await call("POST", "/v1/subcontracts", bearer(s.hirer.apiKey), {
      body: hireBody(s, { workerAgentId: s.hirer.agentId }),
    });
    expect(self.statusCode).toBe(422);
    expect(self.json().error.code).toBe("validation_error");
    const bad = await call("POST", "/v1/subcontracts", bearer(s.hirer.apiKey), {
      body: hireBody(s, { amountCents: 2.5 }),
    });
    expect(bad.statusCode).toBe(400);
  });
});

describe("the job over HTTP", () => {
  it("runs hire → inbox → deliver → accept, with Idempotency-Key on accept", async () => {
    const s = await setup();
    const sc = await hireOpen(s);
    const inbox = await call("GET", "/v1/subcontracts/inbox", bearer(s.worker.apiKey));
    expect(SubcontractList.parse(inbox.json()).subcontracts.map((x) => x.id)).toEqual([sc.id]);

    const delivered = await call("POST", `/v1/subcontracts/${sc.id}/deliver`, bearer(s.worker.apiKey), {
      body: { deliverable: "<script>alert(1)</script>" },
      idem: null,
    });
    expect(delivered.statusCode).toBe(200);
    expect(Subcontract.parse(delivered.json()).status).toBe("delivered");

    const noKey = await call("POST", `/v1/subcontracts/${sc.id}/accept`, bearer(s.hirer.apiKey), {
      body: { rating: 4 },
      idem: null,
    });
    expect(noKey.statusCode).toBe(400);
    const idem = key();
    const accepted = await call("POST", `/v1/subcontracts/${sc.id}/accept`, bearer(s.hirer.apiKey), {
      body: { rating: 4 },
      idem,
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toMatchObject({ status: "accepted", rating: 4 });
    const replay = await call("POST", `/v1/subcontracts/${sc.id}/accept`, bearer(s.hirer.apiKey), {
      body: { rating: 4 },
      idem,
    });
    expect(replay.statusCode).toBe(200);
    const fresh = await call("POST", `/v1/subcontracts/${sc.id}/accept`, bearer(s.hirer.apiKey), {
      body: { rating: 4 },
    });
    expect(fresh.statusCode).toBe(409);
    expect(await getBalances(db, s.workerOwner)).toEqual({ balanceCents: 300n, heldCents: 0n });
    expect(await reconcile(db)).toMatchObject({ ok: true });

    // The worker owner sees it on their agent; the hirer owner on theirs.
    const workerView = await call("GET", `/v1/subcontracts?agentId=${s.worker.agentId}`, await userAuth(s.workerOwner));
    expect(SubcontractList.parse(workerView.json()).subcontracts[0]).toMatchObject({
      id: sc.id,
      deliverable: "<script>alert(1)</script>",
    });
    const hirerView = await call("GET", "/v1/subcontracts?role=hirer", await userAuth(s.hirerOwner));
    expect(hirerView.json().subcontracts).toHaveLength(1);
  });

  it("404s a stranger, 403s the wrong side and refuses an agentId filter from an agent", async () => {
    const s = await setup();
    const sc = await hireOpen(s);
    const strangerOwner = await createUserWithWallet(db);
    const stranger = await createAgent(db, strangerOwner);

    expect((await call("GET", `/v1/subcontracts/${sc.id}`, bearer(stranger.apiKey))).statusCode).toBe(404);
    expect((await call("GET", `/v1/subcontracts/${sc.id}`, await userAuth(strangerOwner))).statusCode).toBe(404);
    expect((await call("GET", `/v1/subcontracts/${sc.id}`, bearer(s.worker.apiKey))).statusCode).toBe(200);
    const wrongSide = await call("POST", `/v1/subcontracts/${sc.id}/deliver`, bearer(s.hirer.apiKey), {
      body: { deliverable: "x" },
    });
    expect(wrongSide.statusCode).toBe(403);
    const strangerDeliver = await call("POST", `/v1/subcontracts/${sc.id}/deliver`, bearer(stranger.apiKey), {
      body: { deliverable: "x" },
    });
    expect(strangerDeliver.statusCode).toBe(404);
    expect((await call("GET", `/v1/subcontracts?agentId=${s.hirer.agentId}`, bearer(s.hirer.apiKey))).statusCode).toBe(
      400,
    );
    // Inbox is for agents.
    expect((await call("GET", "/v1/subcontracts/inbox", await userAuth(s.hirerOwner))).statusCode).toBe(403);
  });

  it("decline, cancel and reject need an Idempotency-Key and release the hold", async () => {
    const s = await setup();
    const a = await hireOpen(s);
    const noKey = await call("POST", `/v1/subcontracts/${a.id}/decline`, bearer(s.worker.apiKey), { idem: null });
    expect(noKey.statusCode).toBe(400);
    expect((await call("POST", `/v1/subcontracts/${a.id}/decline`, bearer(s.worker.apiKey))).json().status).toBe(
      "declined",
    );
    const b = await hireOpen(s);
    expect((await call("POST", `/v1/subcontracts/${b.id}/cancel`, bearer(s.hirer.apiKey))).json().status).toBe(
      "cancelled",
    );
    const c = await hireOpen(s);
    await call("POST", `/v1/subcontracts/${c.id}/deliver`, bearer(s.worker.apiKey), { body: { deliverable: "c" } });
    const rejected = await call("POST", `/v1/subcontracts/${c.id}/reject`, bearer(s.hirer.apiKey), {
      body: { reason: "Not what I asked for" },
    });
    expect(rejected.json()).toMatchObject({ status: "rejected", rejectReason: "Not what I asked for" });
    expect(await getBalances(db, s.hirerOwner)).toEqual({ balanceCents: 5000n, heldCents: 0n });
  });
});

describe("agents: search and skills", () => {
  it("PATCH sets deduped skills for the owner only", async () => {
    const s = await setup();
    const res = await call("PATCH", `/v1/agents/${s.worker.agentId}`, await userAuth(s.workerOwner), {
      body: { skills: ["Extract-Data", "ocr", "extract-data"] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ skills: ["extract-data", "ocr"], completedJobs: 0 });
    const other = await call("PATCH", `/v1/agents/${s.worker.agentId}`, await userAuth(s.hirerOwner), {
      body: { skills: ["x"] },
    });
    expect(other.statusCode).toBe(404);
    const tooMany = await call("PATCH", `/v1/agents/${s.worker.agentId}`, await userAuth(s.workerOwner), {
      body: { skills: Array.from({ length: 11 }, (_, i) => `s${i}`) },
    });
    expect(tooMany.statusCode).toBe(400);
    const asAgent = await call("PATCH", `/v1/agents/${s.worker.agentId}`, bearer(s.worker.apiKey), {
      body: { skills: [] },
    });
    expect(asAgent.statusCode).toBe(403);
  });

  it("filters by skill and minRating, best first, without inactive or keyless agents", async () => {
    const s = await setup();
    const owner = s.workerOwner;
    const mk = async (name: string, rating: number, skills: string[], opts?: Parameters<typeof createAgent>[2]) => {
      const { agentId } = await createAgent(db, owner, opts);
      await db.update(agents).set({ name, rating, skills }).where(eq(agents.id, agentId));
      return agentId;
    };
    const top = await mk("Top", 48, ["ocr", "extract"]);
    const mid = await mk("Mid", 40, ["ocr"]);
    await mk("Low", 20, ["ocr"]);
    await mk("Off", 50, ["ocr"], { status: "suspended" });
    await mk("Revoked", 50, ["ocr"], { revoked: true });

    const auth = bearer(s.hirer.apiKey);
    const ocr = AgentSearchList.parse((await call("GET", "/v1/agents/search?skill=ocr&minRating=40", auth)).json());
    expect(ocr.agents.map((a) => a.id)).toEqual([top, mid]);
    expect(ocr.agents[0]).toEqual({
      id: top,
      name: "Top",
      kind: "external",
      skills: ["ocr", "extract"],
      rating: 48,
      completedJobs: 0,
    });
    const extract = AgentSearchList.parse((await call("GET", "/v1/agents/search?skill=extract", auth)).json());
    expect(extract.agents.map((a) => a.id)).toEqual([top]);
    // Users can search too; every active keyed agent shows without filters.
    const all = await call("GET", "/v1/agents/search", await userAuth(s.hirerOwner));
    expect(all.statusCode).toBe(200);
    expect(all.json().agents).toHaveLength(5);
    expect((await call("GET", "/v1/agents/search?minRating=4.5", auth)).statusCode).toBe(400);
    // The owner's own list is unchanged.
    expect((await call("GET", "/v1/agents", await userAuth(owner))).json().agents).toHaveLength(6);
  });
});
