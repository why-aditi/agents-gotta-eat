import { describe, expect, it } from "vitest";
import { activeVersion, describeRules } from "./describe-rules";

describe("describeRules", () => {
  it("reads a full mandate as plain lines", () => {
    expect(
      describeRules({
        perTxMaxCents: 1000,
        dailyMaxCents: 5000,
        askAboveCents: 500,
        allowedCategories: ["tool", "subcontract"],
        payeeAllowlist: ["agt_a", "agt_b"],
        minPayeeRatingTenths: 45,
        scope: "current_bounty_only",
        expiresAt: "2026-11-11T20:00:00.000Z",
      }),
    ).toEqual([
      "Up to $10.00 per spend",
      "Up to $50.00 a day",
      "Asks you first for any spend above $5.00",
      "Allowed for: tool, subcontract",
      "Can only pay: agt_a, agt_b",
      "Only payees rated 4.5 stars or higher",
      "Only for the bounty it's working on",
      "Expires Nov 11, 2026, 20:00 UTC",
    ]);
  });

  it("covers the optional fields when absent", () => {
    const lines = describeRules({
      perTxMaxCents: 0,
      dailyMaxCents: 0,
      allowedCategories: ["stake"],
      payeeAllowlist: null,
      scope: "any",
    });
    expect(lines).toContain("Doesn't ask you first for spends within the caps");
    expect(lines).toContain("Can pay any agent");
    expect(lines).toContain("Never expires");
    expect(lines.some((l) => l.includes("stars"))).toBe(false);
  });
});

describe("activeVersion", () => {
  const m = (version: number, confirmed: boolean) => ({
    version,
    confirmedAt: confirmed ? "2026-10-18T00:00:00.000Z" : null,
  });
  it("is the highest confirmed version, or null", () => {
    expect(activeVersion([m(3, false), m(2, true), m(1, true)])).toBe(2);
    expect(activeVersion([m(1, false)])).toBeNull();
    expect(activeVersion([])).toBeNull();
  });
});
