// POST /v1/agents/:id/mandate/compile against the fake gateway.
import { CompileMandateResponse } from "@gottaeat/schemas";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp, createAgent, createTestDb, createUser, resetDb, signUserToken } from "../../../test/db";
import { type FakeGateway, startFakeGateway } from "../../../test/fake-gateway";
import { llmCalls, mandates } from "../../db/schema";

const { db, pool } = createTestDb();
let gw: FakeGateway;
let app: ReturnType<typeof buildTestApp>;
let noGateway: ReturnType<typeof buildTestApp>;
beforeAll(async () => {
  gw = await startFakeGateway();
  app = buildTestApp(db, { GATEWAY_URL: gw.url, LITELLM_MASTER_KEY: "sk-master" });
  noGateway = buildTestApp(db);
  await app.ready();
  await noGateway.ready();
});
afterAll(async () => {
  await app.close();
  await noGateway.close();
  await gw.close();
  await pool.end();
});
beforeEach(async () => {
  await resetDb(db);
  gw.reset();
});

const authFor = async (userId: string) =>
  `Bearer ${await signUserToken({ email: `${userId.toLowerCase()}@test.local` })}`;

const WORDS =
  "Up to $20 a day. Only hire agents rated above 4. Ask me for anything over $5. Never more than $10 at once.";
const RULES = {
  perTxMaxCents: 1000,
  dailyMaxCents: 2000,
  askAboveCents: 500,
  allowedCategories: ["subcontract", "tool"],
  payeeAllowlist: null,
  minPayeeRatingTenths: 40,
  scope: "any",
  expiresAt: null,
};

async function compile(a: typeof app, agentId: string, authorization: string | null, sourceText = WORDS) {
  return a.inject({
    method: "POST",
    url: `/v1/agents/${agentId}/mandate/compile`,
    headers: authorization ? { authorization } : {},
    payload: { sourceText },
  });
}

async function owned() {
  const ownerId = await createUser(db);
  const { agentId, apiKey } = await createAgent(db, ownerId);
  return { ownerId, agentId, apiKey, auth: await authFor(ownerId) };
}

describe("POST /v1/agents/:id/mandate/compile", () => {
  it("returns the compiled rules and notes, saves nothing, and wraps the owner's words", async () => {
    const o = await owned();
    gw.enqueue({ json: { rules: RULES, notes: ["Categories default to subcontract and tool."] } });
    const res = await compile(app, o.agentId, o.auth);
    expect(res.statusCode).toBe(200);
    const body = CompileMandateResponse.parse(res.json());
    expect(body).toEqual({ rules: RULES, notes: ["Categories default to subcontract and tool."] });
    expect(await db.select().from(mandates)).toHaveLength(0);
    const [call] = await db.select().from(llmCalls);
    expect(call).toMatchObject({ role: "mandate_compile", model: "primary", outcome: "ok" });
    const sent = gw.requests[0]!;
    expect(sent.headers.authorization).toBe("Bearer sk-master");
    expect(sent.body.model).toBe("primary");
    expect(sent.body.messages[1]?.content).toMatch(/<<<UNTRUSTED:owner_words:[0-9a-f]{16}>>>\nUp to \$20 a day/);
  });

  it("repairs one bad reply", async () => {
    const o = await owned();
    gw.enqueue({ content: "Here you go: rules!" }, { json: { rules: RULES, notes: [] } });
    const res = await compile(app, o.agentId, o.auth);
    expect(res.statusCode).toBe(200);
    expect(gw.requests).toHaveLength(2);
  });

  it.each([
    ["float cents", { ...RULES, perTxMaxCents: 10.5 }],
    ["empty categories", { ...RULES, allowedCategories: [] }],
    ["dollars as strings", { ...RULES, dailyMaxCents: "$20" }],
  ])("502 compile_failed on invalid rules (%s), twice", async (_name, rules) => {
    const o = await owned();
    gw.enqueue({ json: { rules, notes: [] } }, { json: { rules, notes: [] } });
    const res = await compile(app, o.agentId, o.auth);
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({
      error: { code: "compile_failed", message: "Couldn't turn that into rules. Fill them in by hand." },
    });
    expect(await db.select().from(mandates)).toHaveLength(0);
  });

  it("502 compile_failed when the gateway fails, and when there is no gateway", async () => {
    const o = await owned();
    gw.enqueue({ status: 500 });
    expect((await compile(app, o.agentId, o.auth)).json()).toMatchObject({ error: { code: "compile_failed" } });
    const res = await compile(noGateway, o.agentId, o.auth);
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ error: { code: "compile_failed" } });
  });

  it("404 for someone else's agent, 403 for an agent key, 401 without auth, 400 for empty text; no model call", async () => {
    const o = await owned();
    const stranger = await createUser(db);
    expect((await compile(app, o.agentId, await authFor(stranger))).statusCode).toBe(404);
    expect((await compile(app, "agt_missing", o.auth)).statusCode).toBe(404);
    expect((await compile(app, o.agentId, `Bearer ${o.apiKey}`)).statusCode).toBe(403);
    expect((await compile(app, o.agentId, null)).statusCode).toBe(401);
    expect((await compile(app, o.agentId, o.auth, "   ")).statusCode).toBe(400);
    expect(gw.requests).toHaveLength(0);
  });
});
