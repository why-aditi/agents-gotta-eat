import type { Verdict } from "@gottaeat/schemas";
import { describe, expect, it } from "vitest";
import { combine } from "./combine";

const pairs: [Verdict, Verdict, Verdict][] = [
  ["allow", "allow", "allow"],
  ["allow", "ask", "ask"],
  ["allow", "deny", "deny"],
  ["ask", "allow", "ask"],
  ["ask", "ask", "ask"],
  ["ask", "deny", "deny"],
  ["deny", "allow", "deny"],
  ["deny", "ask", "deny"],
  ["deny", "deny", "deny"],
];

describe("combine", () => {
  it.each(pairs)("%s + %s = %s", (a, b, want) => {
    expect(combine(a, b)).toBe(want);
  });

  it("gate 2 can never loosen gate 1", () => {
    expect(combine("deny", "allow")).toBe("deny");
    expect(combine("ask", "allow")).toBe("ask");
  });

  it("handles one or many verdicts and rejects none", () => {
    expect(combine("ask")).toBe("ask");
    expect(combine("allow", "allow", "ask", "allow")).toBe("ask");
    expect(() => combine()).toThrow();
  });
});
