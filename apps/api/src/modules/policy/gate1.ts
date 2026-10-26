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

// The bounty a spend names, as gate 1 needs it. Read-only facts from the arena's tables.
export interface BountyFacts {
  id: string;
  status: string;
  deadlineAt: Date;
  posterId: string;
  rewardCents: bigint;
  // 0-50: the share of the reward an agent may spend on this bounty (amount + fee).
  spendRulePct: number;
}

export interface HardRulesInput {
  mandate: MandateRules | null;
  now: Date;
  // Amount + fee: every cap is measured on what leaves the wallet.
  totalCents: bigint;
  category: SpendCategory;
  // Null for stakes, which have no payee agent.
  payee: PayeeFacts | null;
  requesterAgentId: string;
  requesterOwnerId: string;
  bountyId: string | null;
  // The bounty bountyId names; null when bountyId is null or names nothing.
  bounty: BountyFacts | null;
  // The requester has an active or submitted entry on the named bounty.
  hasEntry: boolean;
  // Amount + fee of this agent's non-stake pending_approval, allowed and settled requests naming the bounty.
  spentOnBountyCents: bigint;
  // Sum of amount + fee of this agent's pending_approval, allowed and settled requests since 00:00 UTC.
  todaySpentCents: bigint;
  // This agent's spend requests (any outcome) in the last 60 s, not counting this one.
  recentCount: number;
  // Available balance of the owner's wallet, read under the wallet row lock.
  balanceCents: bigint;
  // What the owner owes the platform after a PayPal reversal. Above zero the account is frozen.
  owedCents: bigint;
}

export interface GateResult {
  verdict: Verdict;
  reasons: PolicyReason[];
}

// Collects every deny reason so the owner sees all of them at once. Any deny reason → deny; else
// amount + fee strictly above askAboveCents → ask; else allow.
export function evaluateHardRules(input: HardRulesInput): GateResult {
  const deny: DenyReason[] = [];
  const { mandate: rules, bounty } = input;
  const isStake = input.category === "stake";
  // Stakes pay the bounty's stake account, not an agent: the payee checks don't apply.
  const payee = isStake
    ? null
    : (input.payee ?? { agentId: "", exists: false, active: false, ownerId: null, rating: null });

  if (input.owedCents > 0n) deny.push("account_frozen");
  if (input.recentCount + 1 > RATE_LIMIT_MAX) deny.push("rate_limited");

  if (payee) {
    if (!payee.exists) deny.push("unknown_payee");
    else {
      if (payee.agentId === input.requesterAgentId) deny.push("self_payee");
      if (!payee.active) deny.push("payee_inactive");
    }
  }

  // A stake always names a bounty; any spend naming one needs it open and before its deadline.
  if (isStake || input.bountyId) {
    const open = bounty !== null && bounty.status === "open" && input.now.getTime() < bounty.deadlineAt.getTime();
    if (!open) deny.push("bounty_not_open");
  }
  if (isStake && bounty && bounty.posterId === input.requesterOwnerId) deny.push("own_bounty");
  if (!isStake && bounty) {
    const limit = (bounty.rewardCents * BigInt(bounty.spendRulePct)) / 100n;
    if (input.spentOnBountyCents + input.totalCents > limit) deny.push("over_bounty_spend_rule");
  }

  if (!rules) deny.push("no_mandate");
  else {
    if (rules.expiresAt && input.now.getTime() >= new Date(rules.expiresAt).getTime()) deny.push("mandate_expired");
    if (!rules.allowedCategories.includes(input.category)) deny.push("category_not_allowed");
    if (input.totalCents > BigInt(rules.perTxMaxCents)) deny.push("over_per_tx");
    if (input.todaySpentCents + input.totalCents > BigInt(rules.dailyMaxCents)) deny.push("over_daily");
    if (payee?.exists) {
      if (rules.payeeAllowlist && !rules.payeeAllowlist.includes(payee.agentId)) deny.push("payee_not_allowed");
      if (rules.minPayeeRatingTenths !== undefined && (payee.rating ?? 0) < rules.minPayeeRatingTenths) {
        deny.push("payee_rating_too_low");
      }
    }
    if (rules.scope === "current_bounty_only") {
      if (!input.bountyId) deny.push("scope_requires_bounty");
      // Entering is how an agent gets an entry, so the stake itself is exempt.
      else if (!isStake && !input.hasEntry) deny.push("scope_requires_entry");
    }
  }

  if (input.balanceCents < input.totalCents) deny.push("insufficient_funds");

  if (deny.length > 0) return { verdict: "deny", reasons: deny };
  if (rules?.askAboveCents !== undefined && input.totalCents > BigInt(rules.askAboveCents)) {
    return { verdict: "ask", reasons: ["above_ask_threshold"] };
  }
  return { verdict: "allow", reasons: [] };
}
