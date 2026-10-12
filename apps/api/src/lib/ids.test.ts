import { describe, expect, it } from "vitest";
import { newId } from "./ids";

describe("newId", () => {
  it("prefixes a ULID", () => {
    expect(newId("usr")).toMatch(/^usr_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(newId("jnl")).toMatch(/^jnl_[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("sorts in creation order", () => {
    const ids = Array.from({ length: 1000 }, () => newId("len"));
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
