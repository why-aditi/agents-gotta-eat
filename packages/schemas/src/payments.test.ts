import { describe, expect, it } from "vitest";
import { MAX_TOPUP_CENTS, MIN_TOPUP_CENTS, TOPUP_FEE_BPS, TOPUP_FEE_FIXED_CENTS, topupFeeCents } from "./payments";

// What PayPal keeps of a charge, rounded up against us.
const paypalFee = (charge: number) => Math.ceil((charge * TOPUP_FEE_BPS) / 10_000) + TOPUP_FEE_FIXED_CENTS;

describe("topupFeeCents", () => {
  it.each([
    [100, 55], // $1.00 → $1.55
    [500, 69], // $5.00 → $5.69
    [2500, 142], // $25.00 → $26.42
    [10_000, 413], // $100.00 → $104.13
    [MAX_TOPUP_CENTS, 36_213],
  ])("credit %i → fee %i", (credit, fee) => {
    expect(topupFeeCents(credit)).toBe(fee);
  });

  it("rejects below $1.00, above the maximum and non-integers", () => {
    for (const bad of [0, 99, -500, MAX_TOPUP_CENTS + 1, 100.5, Number.NaN, Number.MAX_SAFE_INTEGER]) {
      expect(() => topupFeeCents(bad)).toThrow(RangeError);
    }
    expect(MIN_TOPUP_CENTS).toBe(100);
  });

  it("is exact at the ceil boundary", () => {
    // (credit + 49) * 10000 divisible by 9651: 9651 * k - 49 must be a credit; 9651 * 1 - 49 = 9602.
    expect(((9602 + 49) * 10_000) % 9651).toBe(0);
    expect(topupFeeCents(9602) + 9602).toBe(10_000);
    expect(topupFeeCents(9603) + 9603).toBe(10_002);
  });

  it("nets at least the credit after PayPal's fee, and never more than a cent over", () => {
    const credits = [MIN_TOPUP_CENTS, MAX_TOPUP_CENTS];
    for (let c = MIN_TOPUP_CENTS; c <= MAX_TOPUP_CENTS; c += 997) credits.push(c);
    for (let c = 100; c <= 2000; c++) credits.push(c);
    for (const credit of credits) {
      const charge = credit + topupFeeCents(credit);
      expect(charge - paypalFee(charge), `credit ${credit}`).toBeGreaterThanOrEqual(credit);
      // One cent less would not be enough under the exact (unrounded) rate.
      expect((charge - 1) * (10_000 - TOPUP_FEE_BPS) < (credit + TOPUP_FEE_FIXED_CENTS) * 10_000).toBe(true);
    }
  });
});
