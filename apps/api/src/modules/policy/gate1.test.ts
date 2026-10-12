import type { DenyReason, MandateRules } from "@gottaeat/schemas";
import { describe, expect, it } from "vitest";
import { evaluateHardRules, type HardRulesInput } from "./gate1";

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

function input(over: Partial<HardRulesInput> & { rules?: Partial<MandateRules> } = {}): HardRulesInput {
  const { rules, ...rest } = over;
  return {
    mandate: { ...RULES, ...rules },
    now: NOW,
    totalCents: 100n,
    category: "tool",
    payee: { agentId: "agt_payee", exists: true, active: true, ownerId: "usr_payee", rating: 45 },
    requesterAgentId: "agt_me",
    bountyId: null,
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
    const scoped = input({ bountyId: "bty_1", rules: { scope: "current_bounty_only" } });
    expect(evaluateHardRules(scoped).verdict).toBe("allow");
  });

  it("null allowlist allows anyone; a list allows its members", () => {
    expect(evaluateHardRules(input({ rules: { payeeAllowlist: null } })).verdict).toBe("allow");
    expect(evaluateHardRules(input({ rules: { payeeAllowlist: ["agt_payee"] } })).verdict).toBe("allow");
  });
});
