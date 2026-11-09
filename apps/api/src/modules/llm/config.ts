import type { Db } from "../../db";
import { DEFAULT_DAILY_REQUEST_BUDGET } from "./budget";
import type { LlmConfig } from "./client";

export interface LlmEnv {
  GATEWAY_URL?: string;
  LITELLM_MASTER_KEY?: string;
  LLM_DAILY_REQUEST_BUDGET?: string;
  // Optional provider model id (e.g. openai/gpt-oss-20b). Set: sent instead of the gateway alias, so GATEWAY_URL can
  // be any OpenAI-compatible base URL (https://api.groq.com/openai) and LITELLM_MASTER_KEY its bearer key.
  LLM_MODEL_OVERRIDE?: string;
}

// LLM_DAILY_REQUEST_BUDGET as a non-negative integer, else the default.
export function dailyBudgetFromEnv(env: LlmEnv): number {
  const budget = Number.parseInt(env.LLM_DAILY_REQUEST_BUDGET ?? "", 10);
  return Number.isInteger(budget) && budget >= 0 ? budget : DEFAULT_DAILY_REQUEST_BUDGET;
}

// Null when no gateway is configured: callers then fail closed (compile 502, gate 2 stub, no AI ranking).
export function llmConfigFromEnv(db: Db, env: LlmEnv): LlmConfig | null {
  const gatewayUrl = env.GATEWAY_URL?.trim();
  if (!gatewayUrl) return null;
  return {
    db,
    gatewayUrl,
    apiKey: env.LITELLM_MASTER_KEY || undefined,
    modelOverride: env.LLM_MODEL_OVERRIDE?.trim() || undefined,
    dailyBudget: dailyBudgetFromEnv(env),
  };
}
