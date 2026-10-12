import { describe, expect, it } from "vitest";
import { CreateSpendRequest, DenyReason, MandateRules, PolicyReason } from "./index";

const rules = {
  perTxMaxCents: 1000,
  dailyMaxCents: 2000,
  askAboveCents: 500,
  allowedCategories: ["subcontract", "tool"],
  payeeAllowlist: null,
  minPayeeRatingTenths: 40,
  scope: "any",
  expiresAt: null,
} as const;

describe("MandateRules", () => {
  it("accepts the spec example and optional fields left out", () => {
    expect(MandateRules.parse(rules)).toEqual(rules);
    const minimal = {
      perTxMaxCents: 0,
      dailyMaxCents: 0,
      allowedCategories: ["tool"],
      payeeAllowlist: ["agt_01"],
      scope: "current_bounty_only",
    };
    expect(MandateRules.parse(minimal)).toEqual(minimal);
  });

  it.each(["perTxMaxCents", "dailyMaxCents", "askAboveCents"] as const)("rejects a float or negative %s", (field) => {
    expect(MandateRules.safeParse({ ...rules, [field]: 10.5 }).success).toBe(false);
    expect(MandateRules.safeParse({ ...rules, [field]: -1 }).success).toBe(false);
    expect(MandateRules.safeParse({ ...rules, [field]: "100" }).success).toBe(false);
  });

  it("rejects empty or unknown categories", () => {
    expect(MandateRules.safeParse({ ...rules, allowedCategories: [] }).success).toBe(false);
    expect(MandateRules.safeParse({ ...rules, allowedCategories: ["snacks"] }).success).toBe(false);
  });

  it("bounds the rating to 0-50 tenths, integers only", () => {
    expect(MandateRules.safeParse({ ...rules, minPayeeRatingTenths: 50 }).success).toBe(true);
    expect(MandateRules.safeParse({ ...rules, minPayeeRatingTenths: 51 }).success).toBe(false);
    expect(MandateRules.safeParse({ ...rules, minPayeeRatingTenths: 40.5 }).success).toBe(false);
    expect(MandateRules.safeParse({ ...rules, minPayeeRatingTenths: -1 }).success).toBe(false);
  });

  it("rejects an unknown scope and a non-ISO expiry", () => {
    expect(MandateRules.safeParse({ ...rules, scope: "everything" }).success).toBe(false);
    expect(MandateRules.safeParse({ ...rules, expiresAt: "tomorrow" }).success).toBe(false);
    expect(MandateRules.safeParse({ ...rules, expiresAt: "2026-11-11T00:00:00.000Z" }).success).toBe(true);
  });
});

describe("CreateSpendRequest", () => {
  const body = { payeeAgentId: "agt_01", amountCents: 100, category: "tool", reason: "API credits" };

  it("accepts a valid body", () => {
    expect(CreateSpendRequest.parse(body)).toEqual(body);
  });

  it("rejects zero, float, stake and an oversized reason", () => {
    expect(CreateSpendRequest.safeParse({ ...body, amountCents: 0 }).success).toBe(false);
    expect(CreateSpendRequest.safeParse({ ...body, amountCents: 1.5 }).success).toBe(false);
    expect(CreateSpendRequest.safeParse({ ...body, category: "stake" }).success).toBe(false);
    expect(CreateSpendRequest.safeParse({ ...body, reason: "" }).success).toBe(false);
    expect(CreateSpendRequest.safeParse({ ...body, reason: "x".repeat(501) }).success).toBe(false);
  });
});

describe("PolicyReason", () => {
  it("includes every deny reason", () => {
    for (const r of DenyReason.options) expect(PolicyReason.safeParse(r).success).toBe(true);
    expect(PolicyReason.safeParse("above_ask_threshold").success).toBe(true);
  });
});
