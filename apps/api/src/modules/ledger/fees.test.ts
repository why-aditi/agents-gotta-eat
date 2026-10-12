import { describe, expect, it } from "vitest";
import { subcontractFee } from "./fees";

describe("subcontractFee", () => {
  it.each([
    [800n, 16n],
    [25n, 1n],
    [24n, 0n],
    [0n, 0n],
  ])("%s cents -> %s", (amount, fee) => {
    expect(subcontractFee(amount)).toBe(fee);
  });
});
