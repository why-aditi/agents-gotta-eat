import type { Db } from "../../db";
import { DEFAULT_DAILY_REQUEST_BUDGET } from "./budget";
import type { LlmConfig } from "./client";

export interface LlmEnv {
  GATEWAY_URL?: string;
  LITELLM_MASTER_KEY?: string;
  LLM_DAILY_REQUEST_BUDGET?: string;
}

// Null when no gateway is configured: callers then fail closed (compile 502, gate 2 stub, no AI ranking).
export function llmConfigFromEnv(db: Db, env: LlmEnv): LlmConfig | null {
  const gatewayUrl = env.GATEWAY_URL?.trim();
  if (!gatewayUrl) return null;
  const budget = Number.parseInt(env.LLM_DAILY_REQUEST_BUDGET ?? "", 10);
  return {
    db,
    gatewayUrl,
    apiKey: env.LITELLM_MASTER_KEY || undefined,
    dailyBudget: Number.isInteger(budget) && budget >= 0 ? budget : DEFAULT_DAILY_REQUEST_BUDGET,
  };
}
