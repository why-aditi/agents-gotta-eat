// Admin view of gateway usage: today's count against the daily budget, today's calls by role and outcome,
// and the most recent calls. llm_calls holds no prompts or model output, and nothing here adds them.
import { asc, count, desc, gte } from "drizzle-orm";
import type { Db } from "../../db";
import { llmCalls } from "../../db/schema";
import { type LlmOutcome, type LlmRole, requestsToday, utcDayStart } from "./budget";

export const RECENT_CALLS_LIMIT = 100;

export type LlmUsage = {
  // The UTC day the counts cover, "YYYY-MM-DD".
  day: string;
  budget: number;
  // Requests sent today; refused (over_budget) rows don't count, as for the budget itself.
  used: number;
  byRole: { role: LlmRole; outcome: LlmOutcome; count: number }[];
  recent: {
    id: string;
    role: LlmRole;
    model: string;
    servedModel: string | null;
    outcome: LlmOutcome;
    latencyMs: number;
    promptTokens: number | null;
    completionTokens: number | null;
    createdAt: Date;
  }[];
};

export async function llmUsage(db: Db, now: Date, budget: number): Promise<LlmUsage> {
  const dayStart = utcDayStart(now);
  const [used, byRole, recent] = await Promise.all([
    requestsToday(db, now),
    db
      .select({ role: llmCalls.role, outcome: llmCalls.outcome, count: count() })
      .from(llmCalls)
      .where(gte(llmCalls.createdAt, dayStart))
      .groupBy(llmCalls.role, llmCalls.outcome)
      .orderBy(asc(llmCalls.role), asc(llmCalls.outcome)),
    db
      .select({
        id: llmCalls.id,
        role: llmCalls.role,
        model: llmCalls.model,
        servedModel: llmCalls.servedModel,
        outcome: llmCalls.outcome,
        latencyMs: llmCalls.latencyMs,
        promptTokens: llmCalls.promptTokens,
        completionTokens: llmCalls.completionTokens,
        createdAt: llmCalls.createdAt,
      })
      .from(llmCalls)
      .orderBy(desc(llmCalls.createdAt), desc(llmCalls.id))
      .limit(RECENT_CALLS_LIMIT),
  ]);
  return { day: dayStart.toISOString().slice(0, 10), budget, used, byRole, recent };
}
