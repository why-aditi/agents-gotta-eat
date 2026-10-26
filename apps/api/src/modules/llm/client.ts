// The only caller of the LLM gateway (LiteLLM proxy, OpenAI-compatible). Structured output only: the reply must be
// a JSON object that passes the caller's Zod schema. One repair retry quoting the error, then fail closed.
// Never call this inside a DB transaction: a call can take up to its timeout.
import { eq } from "drizzle-orm";
import type { z } from "zod";
import type { Db } from "../../db";
import { llmCalls } from "../../db/schema";
import { DEFAULT_DAILY_REQUEST_BUDGET, type LlmOutcome, type LlmRole, logLlmCall, overBudget } from "./budget";

export interface LlmConfig {
  db: Db;
  gatewayUrl: string;
  apiKey?: string;
  dailyBudget?: number;
  // Tests swap these.
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

// Gateway model names (gateway/config.yaml), not provider ids.
export type GatewayModel = "primary" | "groq";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmRequest<T> {
  role: LlmRole;
  model: GatewayModel;
  messages: ChatMessage[];
  schema: z.ZodType<T>;
  timeoutMs: number;
  temperature?: number;
}

export type LlmResult<T> =
  | {
      ok: true;
      value: T;
      // The llm_calls row of the request that produced the value.
      callId: string;
      model: GatewayModel;
      servedModel: string | null;
      // The model's reply, exactly as received.
      raw: string;
    }
  | { ok: false; outcome: Exclude<LlmOutcome, "ok">; callId: string; error: string; raw?: string };

export const TIMEOUT_MS = { intentCheck: 5_000, compile: 20_000, judge: 20_000 } as const;

const MAX_ERROR_CHARS = 1_000;

interface Attempt {
  outcome: LlmOutcome;
  callId: string;
  content?: string;
  servedModel: string | null;
  error?: string;
}

const ChatCompletion = {
  parse(body: unknown): {
    content: string | null;
    model: string | null;
    prompt: number | null;
    completion: number | null;
  } {
    const b = (body ?? {}) as {
      model?: unknown;
      choices?: { message?: { content?: unknown } }[];
      usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
    };
    const content = b.choices?.[0]?.message?.content;
    const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);
    return {
      content: typeof content === "string" ? content : null,
      model: typeof b.model === "string" ? b.model : null,
      prompt: int(b.usage?.prompt_tokens),
      completion: int(b.usage?.completion_tokens),
    };
  },
};

// Some models wrap JSON in a ```json fence even when asked not to.
export function stripFence(text: string): string {
  const m = /^\s*```(?:json)?\s*\n?([\s\S]*?)\n?\s*```\s*$/i.exec(text);
  return m?.[1] ?? text;
}

function describeIssues(err: z.ZodError): string {
  return err.issues
    .slice(0, 10)
    .map((i) => `${i.path.length ? i.path.map(String).join(".") : "(root)"}: ${i.message}`)
    .join("; ");
}

export function parseStructured<T>(
  schema: z.ZodType<T>,
  content: string,
): { ok: true; value: T } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(stripFence(content));
  } catch (err) {
    return { ok: false, error: `not valid JSON (${(err as Error).message})` };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return { ok: false, error: describeIssues(parsed.error) };
  return { ok: true, value: parsed.data };
}

async function send(cfg: LlmConfig, req: LlmRequest<unknown>, messages: ChatMessage[]): Promise<Attempt> {
  const now = cfg.now?.() ?? new Date();
  const log = (a: Omit<Parameters<typeof logLlmCall>[1], "role" | "model" | "now">) =>
    logLlmCall(cfg.db, { role: req.role, model: req.model, now, ...a });

  // The budget check comes first, so a refused call never reaches the gateway.
  if (await overBudget(cfg.db, cfg.dailyBudget ?? DEFAULT_DAILY_REQUEST_BUDGET, now)) {
    const callId = await log({ latencyMs: 0, outcome: "over_budget" });
    return { outcome: "over_budget", callId, servedModel: null, error: "daily LLM request budget reached" };
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
        messages,
        response_format: { type: "json_object" },
        temperature: req.temperature ?? 0.2,
      }),
      signal: AbortSignal.timeout(req.timeoutMs),
    });
    body = res.ok ? await res.json() : await res.text().catch(() => "");
  } catch (err) {
    const latencyMs = performance.now() - started;
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    const outcome = timedOut ? "timeout" : "error";
    const callId = await log({ latencyMs, outcome });
    return {
      outcome,
      callId,
      servedModel: null,
      error: timedOut ? `timed out after ${req.timeoutMs} ms` : String(err),
    };
  }
  const latencyMs = performance.now() - started;
  if (!res.ok) {
    const callId = await log({ latencyMs, outcome: "error" });
    return {
      outcome: "error",
      callId,
      servedModel: null,
      error: `gateway returned ${res.status}: ${String(body).slice(0, 200)}`,
    };
  }
  const parsed = ChatCompletion.parse(body);
  // Outcome is provisional here: the caller checks the content against the schema next.
  const outcome: LlmOutcome = parsed.content === null ? "invalid_output" : "ok";
  const callId = await log({
    latencyMs,
    servedModel: parsed.model,
    promptTokens: parsed.prompt,
    completionTokens: parsed.completion,
    outcome,
  });
  return {
    outcome,
    callId,
    servedModel: parsed.model,
    content: parsed.content ?? undefined,
    error: parsed.content === null ? "reply had no message content" : undefined,
  };
}

async function markInvalid(cfg: LlmConfig, callId: string) {
  await cfg.db.update(llmCalls).set({ outcome: "invalid_output" }).where(eq(llmCalls.id, callId));
}

// One structured call: up to two gateway requests (the second is the repair retry). Never throws for model or
// gateway failures; database errors (logging) do throw, and callers fail closed on any throw.
export async function callLlm<T>(cfg: LlmConfig, req: LlmRequest<T>): Promise<LlmResult<T>> {
  let messages = req.messages;
  let lastError = "";
  let lastRaw: string | undefined;
  let lastCallId = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const a = await send(cfg, req, messages);
    lastCallId = a.callId;
    if (a.outcome !== "ok" && a.outcome !== "invalid_output") {
      return { ok: false, outcome: a.outcome, callId: a.callId, error: a.error ?? a.outcome };
    }
    if (a.content !== undefined) {
      const parsed = parseStructured(req.schema, a.content);
      if (parsed.ok) {
        return {
          ok: true,
          value: parsed.value,
          callId: a.callId,
          model: req.model,
          servedModel: a.servedModel,
          raw: a.content,
        };
      }
      await markInvalid(cfg, a.callId);
      lastError = parsed.error.slice(0, MAX_ERROR_CHARS);
      lastRaw = a.content;
    } else {
      lastError = a.error ?? "empty reply";
    }
    // Repair: show the model its reply and the error, ask for the corrected object only.
    messages = [
      ...req.messages,
      { role: "assistant", content: (a.content ?? "").slice(0, 20_000) },
      {
        role: "user",
        content: `That reply was rejected: ${lastError}. Reply again with only the corrected JSON object, in the required format.`,
      },
    ];
  }
  return { ok: false, outcome: "invalid_output", callId: lastCallId, error: lastError, raw: lastRaw };
}
