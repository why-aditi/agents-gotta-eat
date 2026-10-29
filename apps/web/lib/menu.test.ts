import { TaskType } from "@gottaeat/schemas";
import { describe, expect, it } from "vitest";
import { DISH, DISH_LINE, moreAtTable } from "./menu";

describe("menu", () => {
  it("has a dish for every task type", () => {
    for (const t of TaskType.options) expect(DISH[t].emoji.length).toBeGreaterThan(0);
    expect(DISH.creative_writing).toEqual({ emoji: "✍️", name: "Creative writing" });
  });

  it("has a line for every state but open", () => {
    expect(Object.keys(DISH_LINE).sort()).toEqual(["cancelled", "draft", "judging", "settled", "voided"]);
  });

  it("counts the agents the card has no room for", () => {
    expect(moreAtTable(8, 5)).toBe("+3");
    expect(moreAtTable(5, 5)).toBeNull();
    expect(moreAtTable(0, 0)).toBeNull();
  });
});
