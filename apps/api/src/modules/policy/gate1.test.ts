import type { DenyReason, MandateRules } from "@gottaeat/schemas";
import { describe, expect, it } from "vitest";
import { type BountyFacts, evaluateHardRules, type HardRulesInput } from "./gate1";

const NOW = new Date("2026-10-12T12:00:00.000Z");

const RULES: MandateRules = {
  perTxMaxCents: 1000,
  dailyMaxCents: 2000,
  askAboveCents: 500,
  allowedCategories: ["subcontract", "tool"],
  payeeAllowlist: null,
  minPayeeRatingTenths: 40,
  scope: "any",
  expiresAt: null,
};

// Open until an hour from NOW; reward $10.00 with a 20% spend rule, so $2.00 may be spent on it.
const BOUNTY: BountyFacts = {
  id: "bty_1",
  status: "open",
  deadlineAt: new Date(NOW.getTime() + 3_600_000),
  posterId: "usr_poster",
  rewardCents: 1000n,
  spendRulePct: 20,
};

function input(over: Partial<HardRulesInput> & { rules?: Partial<MandateRules> } = {}): HardRulesInput {
  const { rules, ...rest } = over;
  return {
    mandate: { ...RULES, ...rules },
    now: NOW,
    totalCents: 100n,
    category: "tool",
    payee: { agentId: "agt_payee", exists: true, active: true, ownerId: "usr_payee", rating: 45 },
    requesterAgentId: "agt_me",
    requesterOwnerId: "usr_me",
    bountyId: null,
    bounty: null,
    hasEntry: false,
    spentOnBountyCents: 0n,
    todaySpentCents: 0n,
    recentCount: 0,
    balanceCents: 10_000n,
    ...rest,
  };
}

describe("evaluateHardRules", () => {
  it("allows a spend inside every rule", () => {
    expect(evaluateHardRules(input())).toEqual({ verdict: "allow", reasons: [] });
  });

  const denies: [DenyReason, Parameters<typeof input>[0]][] = [
    ["no_mandate", { mandate: null }],
    ["mandate_expired", { rules: { expiresAt: "2026-10-12T11:59:59.000Z" } }],
    ["mandate_expired", { rules: { expiresAt: NOW.toISOString() } }],
    ["insufficient_funds", { balanceCents: 99n }],
    ["over_per_tx", { totalCents: 1001n, rules: { askAboveCents: undefined } }],
    ["over_daily", { todaySpentCents: 1950n, totalCents: 51n }],
    ["category_not_allowed", { category: "subcontract", rules: { allowedCategories: ["tool"] } }],
    ["unknown_payee", { payee: { agentId: "agt_x", exists: false, active: false, ownerId: null, rating: null } }],
    ["payee_inactive", { payee: { agentId: "agt_payee", exists: true, active: false, ownerId: "usr_p", rating: 45 } }],
    ["self_payee", { payee: { agentId: "agt_me", exists: true, active: true, ownerId: "usr_me", rating: 45 } }],
    ["payee_not_allowed", { rules: { payeeAllowlist: ["agt_other"] } }],
    ["payee_rating_too_low", { payee: { agentId: "agt_payee", exists: true, active: true, ownerId: "u", rating: 39 } }],
    ["scope_requires_bounty", { rules: { scope: "current_bounty_only" } }],
    ["rate_limited", { recentCount: 10 }],
  ];

  it.each(denies)("denies %s", (reason, over) => {
    expect(evaluateHardRules(input(over))).toEqual({ verdict: "deny", reasons: [reason] });
  });

  it("allows exactly at the per-tx and daily caps, denies one cent over", () => {
    const rules = { askAboveCents: undefined };
    expect(evaluateHardRules(input({ totalCents: 1000n, rules })).verdict).toBe("allow");
    expect(evaluateHardRules(input({ totalCents: 1001n, rules })).reasons).toEqual(["over_per_tx"]);
    expect(evaluateHardRules(input({ todaySpentCents: 1000n, totalCents: 1000n, rules })).verdict).toBe("allow");
    expect(evaluateHardRules(input({ todaySpentCents: 1001n, totalCents: 1000n, rules })).reasons).toEqual([
      "over_daily",
    ]);
  });

  it("asks only strictly above askAboveCents", () => {
    expect(evaluateHardRules(input({ totalCents: 500n }))).toEqual({ verdict: "allow", reasons: [] });
    expect(evaluateHardRules(input({ totalCents: 501n }))).toEqual({
      verdict: "ask",
      reasons: ["above_ask_threshold"],
    });
  });

  it("allows exactly at the balance and the 10th request in a minute", () => {
    expect(evaluateHardRules(input({ balanceCents: 100n })).verdict).toBe("allow");
    expect(evaluateHardRules(input({ recentCount: 9 })).verdict).toBe("allow");
  });

  it("allows a payee exactly at the minimum rating and skips rating when unset", () => {
    const at = { agentId: "agt_payee", exists: true, active: true, ownerId: "u", rating: 40 };
    expect(evaluateHardRules(input({ payee: at })).verdict).toBe("allow");
    const low = { ...at, rating: 0 };
    expect(evaluateHardRules(input({ payee: low, rules: { minPayeeRatingTenths: undefined } })).verdict).toBe("allow");
  });

  it("collects every deny reason, and deny beats ask", () => {
    const result = evaluateHardRules(
      input({
        totalCents: 5000n,
        balanceCents: 10n,
        recentCount: 12,
        category: "subcontract",
        rules: { allowedCategories: ["tool"], scope: "current_bounty_only", payeeAllowlist: [] },
      }),
    );
    expect(result.verdict).toBe("deny");
    expect([...result.reasons].sort()).toEqual(
      [
        "rate_limited",
        "category_not_allowed",
        "over_per_tx",
        "over_daily",
        "payee_not_allowed",
        "scope_requires_bounty",
        "insufficient_funds",
      ].sort(),
    );
  });

  it("does not need a mandate to report payee, balance and rate reasons", () => {
    const result = evaluateHardRules(
      input({
        mandate: null,
        balanceCents: 0n,
        payee: { agentId: "agt_x", exists: false, active: false, ownerId: null, rating: null },
      }),
    );
    expect([...result.reasons].sort()).toEqual(["insufficient_funds", "no_mandate", "unknown_payee"]);
  });

  it("accepts a mandate expiring in the future and a scoped spend with a bounty", () => {
    expect(evaluateHardRules(input({ rules: { expiresAt: "2026-10-12T12:00:01.000Z" } })).verdict).toBe("allow");
    const scoped = input({
      bountyId: "bty_1",
      bounty: BOUNTY,
      hasEntry: true,
      rules: { scope: "current_bounty_only" },
    });
    expect(evaluateHardRules(scoped).verdict).toBe("allow");
  });

  it("null allowlist allows anyone; a list allows its members", () => {
    expect(evaluateHardRules(input({ rules: { payeeAllowlist: null } })).verdict).toBe("allow");
    expect(evaluateHardRules(input({ rules: { payeeAllowlist: ["agt_payee"] } })).verdict).toBe("allow");
  });
});

// A stake on BOUNTY under a mandate that allows stakes.
function stake(over: Parameters<typeof input>[0] = {}): HardRulesInput {
  const { rules, ...rest } = over ?? {};
  return input({
    category: "stake",
    totalCents: 50n,
    payee: null,
    bountyId: "bty_1",
    bounty: BOUNTY,
    rules: { allowedCategories: ["stake"], ...rules },
    ...rest,
  });
}

// A tool spend naming BOUNTY, by an agent with an entry on it.
function onBounty(over: Parameters<typeof input>[0] = {}): HardRulesInput {
  return input({ bountyId: "bty_1", bounty: BOUNTY, hasEntry: true, ...over });
}

describe("evaluateHardRules: bounties and stakes", () => {
  it("allows a stake on an open bounty and a spend naming one", () => {
    expect(evaluateHardRules(stake())).toEqual({ verdict: "allow", reasons: [] });
    expect(evaluateHardRules(onBounty())).toEqual({ verdict: "allow", reasons: [] });
  });

  const denies: [DenyReason, HardRulesInput][] = [
    ["bounty_not_open", stake({ bounty: null })],
    ["bounty_not_open", stake({ bounty: { ...BOUNTY, status: "draft" } })],
    ["bounty_not_open", stake({ bounty: { ...BOUNTY, status: "judging" } })],
    ["bounty_not_open", stake({ bounty: { ...BOUNTY, deadlineAt: NOW } })],
    ["bounty_not_open", stake({ bounty: { ...BOUNTY, deadlineAt: new Date(NOW.getTime() - 1) } })],
    ["bounty_not_open", onBounty({ bounty: null })],
    ["bounty_not_open", onBounty({ bounty: { ...BOUNTY, status: "cancelled" } })],
    ["bounty_not_open", onBounty({ bounty: { ...BOUNTY, deadlineAt: NOW } })],
    ["own_bounty", stake({ bounty: { ...BOUNTY, posterId: "usr_me" } })],
    ["scope_requires_entry", onBounty({ hasEntry: false, rules: { scope: "current_bounty_only" } })],
    ["over_bounty_spend_rule", onBounty({ spentOnBountyCents: 150n, totalCents: 51n })],
    ["over_bounty_spend_rule", onBounty({ bounty: { ...BOUNTY, spendRulePct: 0 }, totalCents: 1n })],
    ["category_not_allowed", stake({ rules: { allowedCategories: ["tool"] } })],
  ];

  it.each(denies)("denies %s", (reason, hardInput) => {
    expect(evaluateHardRules(hardInput)).toEqual({ verdict: "deny", reasons: [reason] });
  });

  it("is open one millisecond before the deadline", () => {
    const bounty = { ...BOUNTY, deadlineAt: new Date(NOW.getTime() + 1) };
    expect(evaluateHardRules(stake({ bounty })).verdict).toBe("allow");
    expect(evaluateHardRules(onBounty({ bounty })).verdict).toBe("allow");
  });

  it("allows exactly at the bounty spend rule, denies one cent over, flooring the limit", () => {
    expect(evaluateHardRules(onBounty({ spentOnBountyCents: 150n, totalCents: 50n })).verdict).toBe("allow");
    expect(evaluateHardRules(onBounty({ spentOnBountyCents: 0n, totalCents: 201n })).reasons).toEqual([
      "over_bounty_spend_rule",
    ]);
    // 999 * 15 / 100 = 149.85, floored to 149.
    const bounty = { ...BOUNTY, rewardCents: 999n, spendRulePct: 15 };
    expect(evaluateHardRules(onBounty({ bounty, totalCents: 149n })).verdict).toBe("allow");
    expect(evaluateHardRules(onBounty({ bounty, totalCents: 150n })).reasons).toEqual(["over_bounty_spend_rule"]);
  });

  it("does not apply the bounty spend rule to stakes", () => {
    const bounty = { ...BOUNTY, spendRulePct: 0 };
    expect(evaluateHardRules(stake({ bounty, spentOnBountyCents: 10_000n })).verdict).toBe("allow");
  });

  it("skips every payee check for stakes", () => {
    const rules = { payeeAllowlist: ["agt_other"], minPayeeRatingTenths: 50 };
    expect(evaluateHardRules(stake({ rules }))).toEqual({ verdict: "allow", reasons: [] });
    const missing = { agentId: "agt_me", exists: false, active: false, ownerId: null, rating: null };
    expect(evaluateHardRules(stake({ payee: missing }))).toEqual({ verdict: "allow", reasons: [] });
  });

  it("exempts stakes from scope_requires_entry, not from scope_requires_bounty", () => {
    const rules = { scope: "current_bounty_only" as const };
    expect(evaluateHardRules(stake({ rules, hasEntry: false })).verdict).toBe("allow");
    expect(evaluateHardRules(stake({ rules, bountyId: null, bounty: null })).reasons).toEqual([
      "bounty_not_open",
      "scope_requires_bounty",
    ]);
  });

  it("requires an entry only under current_bounty_only", () => {
    expect(evaluateHardRules(onBounty({ hasEntry: false })).verdict).toBe("allow");
    const rules = { scope: "current_bounty_only" as const };
    expect(evaluateHardRules(onBounty({ hasEntry: true, rules })).verdict).toBe("allow");
  });

  it("still applies caps, daily, balance, rate limit, ask threshold and mandate checks to stakes", () => {
    expect(evaluateHardRules(stake({ rules: { perTxMaxCents: 49, askAboveCents: undefined } })).reasons).toEqual([
      "over_per_tx",
    ]);
    expect(evaluateHardRules(stake({ todaySpentCents: 1951n })).reasons).toEqual(["over_daily"]);
    expect(evaluateHardRules(stake({ balanceCents: 49n })).reasons).toEqual(["insufficient_funds"]);
    expect(evaluateHardRules(stake({ recentCount: 10 })).reasons).toEqual(["rate_limited"]);
    expect(evaluateHardRules(stake({ mandate: null })).reasons).toEqual(["no_mandate"]);
    expect(evaluateHardRules(stake({ rules: { expiresAt: NOW.toISOString() } })).reasons).toEqual(["mandate_expired"]);
    expect(evaluateHardRules(stake({ rules: { askAboveCents: 0 } }))).toEqual({
      verdict: "ask",
      reasons: ["above_ask_threshold"],
    });
  });

  it("collects the bounty reasons with the others", () => {
    const result = evaluateHardRules(
      stake({ bounty: { ...BOUNTY, status: "draft", posterId: "usr_me" }, balanceCents: 0n }),
    );
    expect([...result.reasons].sort()).toEqual(["bounty_not_open", "insufficient_funds", "own_bounty"]);
  });
});
