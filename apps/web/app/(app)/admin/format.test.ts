import { describe, expect, it } from "vitest";
import { accountMismatch, centsCell, checkLabel, parseTab, usagePercent } from "./format";

describe("admin format helpers", () => {
  it("parses the tab, defaulting to journals", () => {
    expect(parseTab("accounts")).toBe("accounts");
    expect(parseTab(["llm", "x"])).toBe("llm");
    expect(parseTab("nope")).toBe("journals");
    expect(parseTab(undefined)).toBe("journals");
  });

  it("formats cents cells and leaves non-integers blank", () => {
    expect(centsCell({ value: 123456 })).toBe("$1,234.56");
    expect(centsCell({ value: -50 })).toBe("-$0.50");
    expect(centsCell({ value: 1.5 })).toBe("");
    expect(centsCell({ value: null })).toBe("");
  });

  it("flags a cache mismatch only for wallets with a cache", () => {
    expect(accountMismatch({ balanceCents: 1, cachedBalanceCents: 2 })).toBe(true);
    expect(accountMismatch({ balanceCents: 1, cachedBalanceCents: 1 })).toBe(false);
    expect(accountMismatch({ balanceCents: 1, cachedBalanceCents: null })).toBe(false);
  });

  it("computes whole usage percents", () => {
    expect(usagePercent(1, 3)).toBe(33);
    expect(usagePercent(0, 0)).toBe(0);
    expect(usagePercent(1, 0)).toBe(100);
    expect(usagePercent(5000, 1000)).toBe(100);
  });

  it("labels checks", () => {
    expect(checkLabel("no_negative_wallet")).toBe("No negative wallet");
  });
});
