import { describe, expect, it } from "vitest";
import { beggingHeadline, greeting, mealHeadline, MOOD_LINE, plateLine, spendFacts } from "./kitchen";

describe("kitchen copy", () => {
  it("says what an agent begs for, by kind of spend", () => {
    expect(beggingHeadline("Grifter", 4000, "tool")).toBe("Grifter is begging for $40.00 of snacks");
    expect(beggingHeadline("Scout", 102, "subcontract")).toBe("Scout is begging for $1.02: a helper's lunch");
    expect(beggingHeadline("Sieve", 50, "stake")).toBe("Sieve is begging for $0.50: a seat at a bounty's table");
  });

  it("tells each meal by how it ended", () => {
    expect(mealHeadline("settled", 800, "tool")).toBe("Ate $8.00 of snacks");
    expect(mealHeadline("allowed", 800, "subcontract")).toBe("Is eating $8.00: a helper's lunch");
    expect(mealHeadline("pending_approval", 800, "tool")).toBe("Asked for $8.00 of snacks");
    expect(mealHeadline("denied", 50, "stake")).toBe("Was told no to $0.50: a seat at a bounty's table");
    expect(mealHeadline("released", 800, "tool")).toBe("Put back $8.00 of snacks");
  });

  it("keeps a plain facts line next to every playful one", () => {
    expect(spendFacts(4000, 0, "tool", "Agent X")).toBe("$40.00 tool spend to Agent X");
    expect(spendFacts(800, 40, "subcontract", null)).toBe("$8.00 subcontract spend + $0.40 fee");
  });

  it("describes today's plate", () => {
    expect(plateLine(720, 1000)).toBe("$7.20 of $10.00 eaten today");
    expect(plateLine(0, 1000)).toBe("Nothing eaten yet · $10.00 a day");
    expect(plateLine(0, null)).toBe("No diet yet: give it a mandate");
  });

  it("greets by the hour and has a line for every mood", () => {
    expect([greeting(3), greeting(9), greeting(14), greeting(20)]).toEqual([
      "Up late",
      "Good morning",
      "Good afternoon",
      "Good evening",
    ]);
    expect(Object.keys(MOOD_LINE)).toHaveLength(7);
  });
});
