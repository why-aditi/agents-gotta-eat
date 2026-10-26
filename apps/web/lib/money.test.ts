import { describe, expect, it } from "vitest";
import { centsToInput, formatCents, formatTenths, parseDollarsToCents, parseRatingToTenths } from "./money";

describe("parseDollarsToCents", () => {
  it.each([
    ["12", 1200],
    ["12.5", 1250],
    ["12.50", 1250],
    [".5", 50],
    ["0.01", 1],
    ["0", 0],
    ["007.10", 710],
    ["  3.25 ", 325],
  ])("%j -> %i cents", (input, cents) => {
    expect(parseDollarsToCents(input)).toEqual({ ok: true, cents });
  });

  it("accepts the largest safe amount and rejects one cent more", () => {
    expect(parseDollarsToCents("90071992547409.91")).toEqual({ ok: true, cents: Number.MAX_SAFE_INTEGER });
    expect(parseDollarsToCents("90071992547409.92").ok).toBe(false);
    expect(parseDollarsToCents("999999999999999999").ok).toBe(false);
  });

  it.each(["1.234", "12.", "-1", "abc", "1e3", "", " ", ".", "1,000", "+5", "1.2.3", "$5", "0x10", "Infinity"])(
    "rejects %j",
    (input) => {
      const r = parseDollarsToCents(input);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/\S/);
    },
  );
});

describe("formatCents", () => {
  it.each([
    [0, "$0.00"],
    [1, "$0.01"],
    [50, "$0.50"],
    [1250, "$12.50"],
    [123456, "$1,234.56"],
    [100000000, "$1,000,000.00"],
    [-50, "-$0.50"],
    [Number.MAX_SAFE_INTEGER, "$90,071,992,547,409.91"],
  ])("%i -> %s", (cents, text) => {
    expect(formatCents(cents)).toBe(text);
  });

  it("refuses non-integers", () => {
    expect(() => formatCents(1.5)).toThrow(RangeError);
  });

  it("round-trips through the parser for inputs", () => {
    expect(centsToInput(123456)).toBe("1234.56");
    expect(parseDollarsToCents(centsToInput(123456))).toEqual({ ok: true, cents: 123456 });
  });
});

describe("rating tenths", () => {
  it.each([
    ["4.5", 45],
    ["4", 40],
    ["0", 0],
    ["0.0", 0],
    ["5", 50],
    ["5.0", 50],
    [".3", 3],
  ])("%j -> %i tenths", (input, tenths) => {
    expect(parseRatingToTenths(input)).toEqual({ ok: true, tenths });
  });

  it.each(["5.1", "6", "4.55", "-1", "abc", "", " ", "10", "1e0"])("rejects %j", (input) => {
    expect(parseRatingToTenths(input).ok).toBe(false);
  });

  it("formats tenths", () => {
    expect(formatTenths(45)).toBe("4.5");
    expect(formatTenths(50)).toBe("5.0");
    expect(formatTenths(0)).toBe("0.0");
  });
});
