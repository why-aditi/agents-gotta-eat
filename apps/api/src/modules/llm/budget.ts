// The global daily request budget and the llm_calls log. Every gateway request writes one row, and so does
// every request the budget refused. Today (UTC) means since midnight UTC.
import { and, count, gte, ne } from "drizzle-orm";
import type { Db } from "../../db";
import { llmCalls } from "../../db/schema";
import { newId } from "../../lib/ids";

export type LlmRole = (typeof llmCalls.$inferSelect)["role"];
export type LlmOutcome = (typeof llmCalls.$inferSelect)["outcome"];

export const DEFAULT_DAILY_REQUEST_BUDGET = 1000;

export function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// Requests sent today. Refused (over_budget) rows are logged but never reached the gateway, so they don't count.
export async function requestsToday(db: Db, now: Date): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(llmCalls)
    .where(and(gte(llmCalls.createdAt, utcDayStart(now)), ne(llmCalls.outcome, "over_budget")));
  return row?.n ?? 0;
}

export async function overBudget(db: Db, budget: number, now: Date): Promise<boolean> {
  return (await requestsToday(db, now)) >= budget;
}

export interface LlmCallLog {
  role: LlmRole;
  model: string;
  servedModel?: string | null;
  latencyMs: number;
  promptTokens?: number | null;
  completionTokens?: number | null;
  outcome: LlmOutcome;
  now: Date;
}

export async function logLlmCall(db: Db, log: LlmCallLog): Promise<string> {
  const id = newId("llm");
  await db.insert(llmCalls).values({
    id,
    role: log.role,
    model: log.model,
    servedModel: log.servedModel ?? null,
    latencyMs: Math.max(0, Math.round(log.latencyMs)),
    promptTokens: log.promptTokens ?? null,
    completionTokens: log.completionTokens ?? null,
    outcome: log.outcome,
    createdAt: log.now,
  });
  return id;
}
