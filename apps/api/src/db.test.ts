import { describe, expect, it } from "vitest";
import { poolMaxFromEnv } from "./db";

describe("poolMaxFromEnv", () => {
  it.each([
    [undefined, 10],
    ["", 10],
    ["20", 20],
    ["1", 1],
    ["100", 100],
    ["0", 10],
    ["101", 10],
    ["2.5", 10],
    ["lots", 10],
  ])("%s → %d", (value, expected) => {
    expect(poolMaxFromEnv(value)).toBe(expected);
  });
});
