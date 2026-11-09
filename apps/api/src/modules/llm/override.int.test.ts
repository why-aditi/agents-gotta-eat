import { z } from "zod";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, resetDb } from "../../../test/db";
import { callLlm, type LlmConfig } from "./client";
import { llmConfigFromEnv } from "./config";
import { chatWithTools } from "./tools";

const { db, pool } = createTestDb();
afterAll(() => pool.end());
beforeEach(() => resetDb(db));

// A Groq-shaped reply: content null with tool_calls, a `reasoning` extra, and a long tool-call id.
const groqReply = (message: Record<string, unknown>) =>
  new Response(
    JSON.stringify({
      id: "x",
      model: "openai/gpt-oss-20b",
      choices: [{ index: 0, message: { role: "assistant", reasoning: "thinking", ...message }, finish_reason: "stop" }],
      usage: { prompt_tokens: 5, completion_tokens: 3 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

function stub(message: Record<string, unknown>) {
  const seen: { url: string; body: Record<string, unknown>; auth: string | null }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    seen.push({
      url,
      body: JSON.parse(String(init.body)),
      auth: new Headers(init.headers).get("authorization"),
    });
    return groqReply(message);
  }) as unknown as typeof fetch;
  return { seen, fetchImpl };
}

const Out = z.object({ answer: z.int() });
const structured = {
  role: "mandate_compile",
  model: "primary",
  schema: Out,
  timeoutMs: 2_000,
  messages: [{ role: "user", content: "json" }],
} as const;
const tools = {
  role: "treasurer",
  model: "groq",
  timeoutMs: 2_000,
  messages: [{ role: "user" as const, content: "hi" }],
  tools: [],
} as never;

const cfg = (fetchImpl: typeof fetch, over?: Partial<LlmConfig>): LlmConfig => ({
  db,
  gatewayUrl: "https://api.groq.com/openai",
  apiKey: "k",
  fetchImpl,
  ...over,
});

describe("LLM_MODEL_OVERRIDE", () => {
  it("replaces the alias in structured calls and builds /openai/v1/chat/completions", async () => {
    const { seen, fetchImpl } = stub({ content: '{"answer":42}' });
    const res = await callLlm(cfg(fetchImpl, { modelOverride: "openai/gpt-oss-20b" }), structured as never);
    expect(res).toMatchObject({ ok: true, value: { answer: 42 } });
    expect(seen[0]?.url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(seen[0]?.body.model).toBe("openai/gpt-oss-20b");
    expect(seen[0]?.auth).toBe("Bearer k");
  });

  it("replaces the alias in tool calls and parses content null with tool_calls", async () => {
    const id = "c".repeat(150);
    const { seen, fetchImpl } = stub({
      content: null,
      tool_calls: [{ id, type: "function", function: { name: "t", arguments: "{}" } }],
    });
    const res = await chatWithTools(cfg(fetchImpl, { modelOverride: "openai/gpt-oss-20b" }), tools);
    expect(seen[0]?.body.model).toBe("openai/gpt-oss-20b");
    expect(res).toMatchObject({ ok: true, content: null });
    expect(res.ok && res.toolCalls).toHaveLength(1);
  });

  it("unset: the alias is sent unchanged (both paths) and a trailing slash is trimmed", async () => {
    const a = stub({ content: '{"answer":1}' });
    await callLlm(cfg(a.fetchImpl, { gatewayUrl: "http://gw:4000/" }), structured as never);
    expect(a.seen[0]?.body.model).toBe("primary");
    expect(a.seen[0]?.url).toBe("http://gw:4000/v1/chat/completions");
    const b = stub({ content: "ok" });
    await chatWithTools(cfg(b.fetchImpl), tools);
    expect(b.seen[0]?.body.model).toBe("groq");
  });

  it("llmConfigFromEnv reads it, trims it, and treats blank as unset", () => {
    const env = { GATEWAY_URL: "https://api.groq.com/openai", LITELLM_MASTER_KEY: "k" };
    expect(llmConfigFromEnv(db, { ...env, LLM_MODEL_OVERRIDE: " openai/gpt-oss-20b " })?.modelOverride).toBe(
      "openai/gpt-oss-20b",
    );
    expect(llmConfigFromEnv(db, { ...env, LLM_MODEL_OVERRIDE: "  " })?.modelOverride).toBeUndefined();
    expect(llmConfigFromEnv(db, env)?.modelOverride).toBeUndefined();
  });
});
