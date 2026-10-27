// One gateway request in the OpenAI tool-call format, for agent loops (the Treasurer). Same budget and llm_calls
// logging as callLlm; no structured-output repair (the caller runs its own loop). Never throws for model or
// gateway failures; database errors (logging) do throw. Never call this inside a DB transaction.
import { DEFAULT_DAILY_REQUEST_BUDGET, type LlmOutcome, type LlmRole, logLlmCall, overBudget } from "./budget";
import type { GatewayModel, LlmConfig } from "./client";

export interface ToolDefinition {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type ToolChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface ToolChatRequest {
  role: LlmRole;
  model: GatewayModel;
  messages: ToolChatMessage[];
  tools: ToolDefinition[];
  // "none" asks for a final answer without more tool calls.
  toolChoice?: "auto" | "none";
  timeoutMs: number;
  temperature?: number;
}

export type ToolChatResult =
  | { ok: true; callId: string; content: string | null; toolCalls: ToolCall[]; servedModel: string | null }
  | { ok: false; outcome: Exclude<LlmOutcome, "ok">; callId: string; error: string };

const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);

function parseToolCalls(raw: unknown): ToolCall[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return null;
  const out: ToolCall[] = [];
  for (const [i, c] of raw.entries()) {
    const fn = (c as { function?: { name?: unknown; arguments?: unknown } } | null)?.function;
    if (!fn || typeof fn.name !== "string") return null;
    const args = typeof fn.arguments === "string" ? fn.arguments : JSON.stringify(fn.arguments ?? {});
    const id = (c as { id?: unknown }).id;
    out.push({
      id: typeof id === "string" && id ? id.slice(0, 100) : `call_${i}`,
      type: "function",
      function: { name: fn.name.slice(0, 100), arguments: args },
    });
  }
  return out;
}

export async function chatWithTools(cfg: LlmConfig, req: ToolChatRequest): Promise<ToolChatResult> {
  const now = cfg.now?.() ?? new Date();
  const log = (a: Omit<Parameters<typeof logLlmCall>[1], "role" | "model" | "now">) =>
    logLlmCall(cfg.db, { role: req.role, model: req.model, now, ...a });

  if (await overBudget(cfg.db, cfg.dailyBudget ?? DEFAULT_DAILY_REQUEST_BUDGET, now)) {
    const callId = await log({ latencyMs: 0, outcome: "over_budget" });
    return { ok: false, outcome: "over_budget", callId, error: "daily LLM request budget reached" };
  }

  const started = performance.now();
  const doFetch = cfg.fetchImpl ?? fetch;
  let res: Response;
  let body: unknown;
  try {
    res = await doFetch(`${cfg.gatewayUrl.replace(/\/+$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        tools: req.tools,
        tool_choice: req.toolChoice ?? "auto",
        temperature: req.temperature ?? 0.1,
      }),
      signal: AbortSignal.timeout(req.timeoutMs),
    });
    body = res.ok ? await res.json() : await res.text().catch(() => "");
  } catch (err) {
    const latencyMs = performance.now() - started;
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    const outcome = timedOut ? "timeout" : "error";
    const callId = await log({ latencyMs, outcome });
    return { ok: false, outcome, callId, error: timedOut ? `timed out after ${req.timeoutMs} ms` : String(err) };
  }
  const latencyMs = performance.now() - started;
  if (!res.ok) {
    const callId = await log({ latencyMs, outcome: "error" });
    return {
      ok: false,
      outcome: "error",
      callId,
      error: `gateway returned ${res.status}: ${String(body).slice(0, 200)}`,
    };
  }
  const b = (body ?? {}) as {
    model?: unknown;
    choices?: { message?: { content?: unknown; tool_calls?: unknown } }[];
    usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
  };
  const message = b.choices?.[0]?.message;
  const content = typeof message?.content === "string" ? message.content : null;
  const toolCalls = parseToolCalls(message?.tool_calls);
  const servedModel = typeof b.model === "string" ? b.model : null;
  const valid = toolCalls !== null && (content !== null || toolCalls.length > 0);
  const callId = await log({
    latencyMs,
    servedModel,
    promptTokens: int(b.usage?.prompt_tokens),
    completionTokens: int(b.usage?.completion_tokens),
    outcome: valid ? "ok" : "invalid_output",
  });
  if (!valid) return { ok: false, outcome: "invalid_output", callId, error: "reply had no content or tool calls" };
  return { ok: true, callId, content, toolCalls: toolCalls ?? [], servedModel };
}
