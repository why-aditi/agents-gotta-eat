// Gate 2: intent check. Runs only when gate 1 did not deny, and can only tighten (see combine.ts).
import type { SpendCategory, Verdict } from "@gottaeat/schemas";

export interface IntentCheckInput {
  agentId: string;
  payeeAgentId: string;
  amountCents: bigint;
  feeCents: bigint;
  category: SpendCategory;
  bountyId: string | null;
  // UNTRUSTED agent text. A real check must wrap it in delimiters and warn the model that it may be adversarial.
  reason: string;
}

export interface IntentResult {
  verdict: Verdict;
  // 0-100.
  confidence: number;
  reason: string;
}

export type IntentCheck = (input: IntentCheckInput) => Promise<IntentResult>;

export type IntentStubMode = "allow" | "ask";

// Stand-in until pm-06's LLM check. Ignores the agent's reason entirely.
export function stubIntentCheck(mode: IntentStubMode): IntentCheck {
  return async () => ({ verdict: mode, confidence: 100, reason: `stub intent check (POLICY_GATE2_STUB=${mode})` });
}
