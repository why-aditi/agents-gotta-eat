// Gate 1: deterministic hard rules. Pure, no I/O, and always runs before any LLM call.
import type { DenyReason, MandateRules, PolicyReason, SpendCategory, Verdict } from "@gottaeat/schemas";

export const RATE_LIMIT_MAX = 10;
export const RATE_LIMIT_WINDOW_MS = 60_000;

export interface PayeeFacts {
  agentId: string;
  exists: boolean;
  active: boolean;
  ownerId: string | null;
  // Tenths of a star: 4.0 is 40. Null when the payee does not exist.
  rating: number | null;
}

export interface HardRulesInput {
  mandate: MandateRules | null;
  now: Date;
  // Amount + fee: every cap is measured on what leaves the wallet.
  totalCents: bigint;
  category: SpendCategory;
  payee: PayeeFacts;
  requesterAgentId: string;
  bountyId: string | null;
  // Sum of amount + fee of this agent's pending_approval, allowed and settled requests since 00:00 UTC.
  todaySpentCents: bigint;
  // This agent's spend requests (any outcome) in the last 60 s, not counting this one.
  recentCount: number;
  // Available balance of the owner's wallet, read under the wallet row lock.
  balanceCents: bigint;
}

export interface GateResult {
  verdict: Verdict;
  reasons: PolicyReason[];
}

// Collects every deny reason so the owner sees all of them at once. Any deny reason → deny; else
// amount + fee strictly above askAboveCents → ask; else allow.
export function evaluateHardRules(input: HardRulesInput): GateResult {
  const deny: DenyReason[] = [];
  const { mandate: rules, payee } = input;

  if (input.recentCount + 1 > RATE_LIMIT_MAX) deny.push("rate_limited");

  if (!payee.exists) deny.push("unknown_payee");
  else {
    if (payee.agentId === input.requesterAgentId) deny.push("self_payee");
    if (!payee.active) deny.push("payee_inactive");
  }

  if (!rules) deny.push("no_mandate");
  else {
    if (rules.expiresAt && input.now.getTime() >= new Date(rules.expiresAt).getTime()) deny.push("mandate_expired");
    if (!rules.allowedCategories.includes(input.category)) deny.push("category_not_allowed");
    if (input.totalCents > BigInt(rules.perTxMaxCents)) deny.push("over_per_tx");
    if (input.todaySpentCents + input.totalCents > BigInt(rules.dailyMaxCents)) deny.push("over_daily");
    if (payee.exists) {
      if (rules.payeeAllowlist && !rules.payeeAllowlist.includes(payee.agentId)) deny.push("payee_not_allowed");
      if (rules.minPayeeRatingTenths !== undefined && (payee.rating ?? 0) < rules.minPayeeRatingTenths) {
        deny.push("payee_rating_too_low");
      }
    }
    // The bounty spend rule joins here once Arena exists.
    if (rules.scope === "current_bounty_only" && !input.bountyId) deny.push("scope_requires_bounty");
  }

  if (input.balanceCents < input.totalCents) deny.push("insufficient_funds");

  if (deny.length > 0) return { verdict: "deny", reasons: deny };
  if (rules?.askAboveCents !== undefined && input.totalCents > BigInt(rules.askAboveCents)) {
    return { verdict: "ask", reasons: ["above_ask_threshold"] };
  }
  return { verdict: "allow", reasons: [] };
}
