import { describe, expect, it } from "vitest";
import { centsToValue, valueToCents } from "./cents";

describe("centsToValue", () => {
  it.each([
    [0n, "0.00"],
    [1n, "0.01"],
    [99n, "0.99"],
    [100n, "1.00"],
    [1234n, "12.34"],
    [123456789n, "1234567.89"],
  ])("%s -> %s", (cents, value) => {
    expect(centsToValue(cents)).toBe(value);
  });

  it("rejects negatives", () => {
    expect(() => centsToValue(-1n)).toThrow(RangeError);
  });
});

describe("valueToCents", () => {
  it.each([
    ["0", 0n],
    ["0.00", 0n],
    ["0.01", 1n],
    ["0.99", 99n],
    ["1.00", 100n],
    ["12.3", 1230n],
    ["12.34", 1234n],
    ["1234567.89", 123456789n],
    ["99999999.99", 9999999999n],
  ])("%s -> %s", (value, cents) => {
    expect(valueToCents(value)).toBe(cents);
  });

  it.each(["1.234", "-1", "1e3", "", "abc", "1.", ".5", " 1.00", "+1.00", "1,00"])("rejects %j", (value) => {
    expect(() => valueToCents(value)).toThrow(RangeError);
  });

  it("round-trips", () => {
    for (const c of [0n, 5n, 100n, 101n, 987654321n]) expect(valueToCents(centsToValue(c))).toBe(c);
  });
});
