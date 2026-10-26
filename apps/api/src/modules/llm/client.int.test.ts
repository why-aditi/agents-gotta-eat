import { asc } from "drizzle-orm";
import { z } from "zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, resetDb } from "../../../test/db";
import { type FakeGateway, startFakeGateway } from "../../../test/fake-gateway";
import { llmCalls } from "../../db/schema";
import { logLlmCall, requestsToday } from "./budget";
import { callLlm, type LlmConfig, type LlmRequest, stripFence } from "./client";
import { llmConfigFromEnv } from "./config";

const { db, pool } = createTestDb();
let gw: FakeGateway;
beforeAll(async () => {
  gw = await startFakeGateway();
});
afterAll(async () => {
  await gw.close();
  await pool.end();
});
beforeEach(async () => {
  await resetDb(db);
  gw.reset();
});

const cfg = (over?: Partial<LlmConfig>): LlmConfig => ({
  db,
  gatewayUrl: gw.url,
  apiKey: "sk-test-master",
  dailyBudget: 100,
  ...over,
});
const Out = z.object({ answer: z.int() });
const req = (over?: Partial<LlmRequest<z.infer<typeof Out>>>): LlmRequest<z.infer<typeof Out>> => ({
  role: "mandate_compile",
  model: "primary",
  messages: [
    { role: "system", content: "Reply with JSON." },
    { role: "user", content: "What is 6 * 7?" },
  ],
  schema: Out,
  timeoutMs: 2_000,
  ...over,
});
const calls = () => db.select().from(llmCalls).orderBy(asc(llmCalls.id));

describe("callLlm", () => {
  it("parses a valid reply and logs one ok row with model, tokens and latency", async () => {
    gw.enqueue({ json: { answer: 42 }, model: "gemini/gemini-3.8-flash" });
    const res = await callLlm(cfg(), req());
    expect(res).toMatchObject({
      ok: true,
      value: { answer: 42 },
      model: "primary",
      servedModel: "gemini/gemini-3.8-flash",
    });
    const rows = await calls();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      role: "mandate_compile",
      model: "primary",
      servedModel: "gemini/gemini-3.8-flash",
      promptTokens: 11,
      completionTokens: 7,
      outcome: "ok",
    });
    expect(rows[0]?.latencyMs).toBeGreaterThanOrEqual(0);
    expect(res.ok && res.callId).toBe(rows[0]?.id);
  });

  it("sends the master key, the gateway model name and asks for a JSON object", async () => {
    gw.enqueue({ json: { answer: 1 } });
    await callLlm(cfg(), req({ temperature: 0 }));
    const [r] = gw.requests;
    expect(r?.headers.authorization).toBe("Bearer sk-test-master");
    expect(r?.body).toMatchObject({ model: "primary", response_format: { type: "json_object" }, temperature: 0 });
    expect(r?.body.messages).toHaveLength(2);
  });

  it("repairs a malformed reply once, quoting the error", async () => {
    gw.enqueue({ content: "{not json" }, { json: { answer: 42 } });
    const res = await callLlm(cfg(), req());
    expect(res).toMatchObject({ ok: true, value: { answer: 42 } });
    expect(gw.requests).toHaveLength(2);
    const repair = gw.requests[1]!.body.messages;
    expect(repair.at(-2)).toEqual({ role: "assistant", content: "{not json" });
    expect(repair.at(-1)?.content).toMatch(/rejected: not valid JSON/);
    expect((await calls()).map((c) => c.outcome)).toEqual(["invalid_output", "ok"]);
  });

  it("schema failures are repaired too (a float where an integer belongs)", async () => {
    gw.enqueue({ json: { answer: 4.2 } }, { json: { answer: 4 } });
    const res = await callLlm(cfg(), req());
    expect(res).toMatchObject({ ok: true, value: { answer: 4 } });
    expect(gw.requests[1]!.body.messages.at(-1)?.content).toMatch(/answer/);
  });

  it("fails closed with invalid_output after a second bad reply", async () => {
    gw.enqueue({ content: "nope" }, { json: { answer: "forty-two" } });
    const res = await callLlm(cfg(), req());
    expect(res).toMatchObject({ ok: false, outcome: "invalid_output" });
    expect(gw.requests).toHaveLength(2);
    expect((await calls()).map((c) => c.outcome)).toEqual(["invalid_output", "invalid_output"]);
  });

  it("times out and logs a timeout row (no retry)", async () => {
    gw.enqueue({ json: { answer: 1 }, delayMs: 500 });
    const res = await callLlm(cfg(), req({ timeoutMs: 100 }));
    expect(res).toMatchObject({ ok: false, outcome: "timeout" });
    expect((await calls()).map((c) => c.outcome)).toEqual(["timeout"]);
  });

  it("a gateway 500 fails with error (no retry)", async () => {
    gw.enqueue({ status: 500, body: "all providers failed" });
    const res = await callLlm(cfg(), req());
    expect(res).toMatchObject({ ok: false, outcome: "error" });
    expect(!res.ok && res.error).toMatch(/500/);
    expect(gw.requests).toHaveLength(1);
    expect((await calls()).map((c) => c.outcome)).toEqual(["error"]);
  });

  it("an unreachable gateway fails with error", async () => {
    const res = await callLlm(cfg({ gatewayUrl: "http://127.0.0.1:9" }), req());
    expect(res).toMatchObject({ ok: false, outcome: "error" });
    expect((await calls()).map((c) => c.outcome)).toEqual(["error"]);
  });

  it("over budget: no HTTP call, an over_budget row, and refused rows don't count", async () => {
    const now = new Date();
    for (let i = 0; i < 3; i++) {
      await logLlmCall(db, { role: "judge", model: "primary", latencyMs: 1, outcome: "ok", now });
    }
    gw.enqueue({ json: { answer: 1 } });
    const res = await callLlm(cfg({ dailyBudget: 3 }), req());
    expect(res).toMatchObject({ ok: false, outcome: "over_budget" });
    expect(gw.requests).toHaveLength(0);
    expect((await calls()).at(-1)?.outcome).toBe("over_budget");
    expect(await requestsToday(db, now)).toBe(3);
  });

  it("yesterday's calls don't count against today's budget", async () => {
    const yesterday = new Date(Date.now() - 86_400_000);
    await logLlmCall(db, { role: "judge", model: "primary", latencyMs: 1, outcome: "ok", now: yesterday });
    gw.enqueue({ json: { answer: 1 } });
    expect(await callLlm(cfg({ dailyBudget: 1 }), req())).toMatchObject({ ok: true });
  });

  it("the repair retry is also checked against the budget", async () => {
    gw.enqueue({ content: "bad" }, { json: { answer: 1 } });
    const res = await callLlm(cfg({ dailyBudget: 1 }), req());
    expect(res).toMatchObject({ ok: false, outcome: "over_budget" });
    expect(gw.requests).toHaveLength(1);
  });

  it("accepts JSON inside a markdown fence", () => {
    expect(stripFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripFence('{"a":1}')).toBe('{"a":1}');
  });
});

describe("llmConfigFromEnv", () => {
  it("is null without a gateway url, and reads the key and budget", () => {
    expect(llmConfigFromEnv(db, {})).toBeNull();
    expect(llmConfigFromEnv(db, { GATEWAY_URL: " " })).toBeNull();
    expect(
      llmConfigFromEnv(db, { GATEWAY_URL: "http://gw", LITELLM_MASTER_KEY: "k", LLM_DAILY_REQUEST_BUDGET: "5" }),
    ).toMatchObject({ gatewayUrl: "http://gw", apiKey: "k", dailyBudget: 5 });
    expect(llmConfigFromEnv(db, { GATEWAY_URL: "http://gw", LLM_DAILY_REQUEST_BUDGET: "lots" })?.dailyBudget).toBe(
      1000,
    );
  });
});
