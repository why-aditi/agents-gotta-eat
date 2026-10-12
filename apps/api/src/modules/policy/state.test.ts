import type { SpendStatus } from "@gottaeat/schemas";
import { describe, expect, it } from "vitest";
import { InvalidTransitionError, SPEND_STATUSES, type SpendFrom, transition } from "./state";

const ALLOWED: [SpendFrom, SpendStatus][] = [
  ["new", "denied"],
  ["new", "settled"],
  ["new", "allowed"],
  ["new", "pending_approval"],
  ["pending_approval", "settled"],
  ["pending_approval", "allowed"],
  ["pending_approval", "released"],
  ["allowed", "settled"],
  ["allowed", "released"],
];

const TARGETS: SpendStatus[] = ["pending_approval", "allowed", "settled", "denied", "released"];

describe("transition", () => {
  it.each(ALLOWED)("%s -> %s is allowed", (from, to) => {
    expect(transition(from, to)).toBe(to);
  });

  const others = SPEND_STATUSES.flatMap((from) => TARGETS.map((to) => [from, to] as [SpendFrom, SpendStatus])).filter(
    ([from, to]) => !ALLOWED.some(([f, t]) => f === from && t === to),
  );

  it("covers every pair", () => {
    expect(others.length + ALLOWED.length).toBe(6 * 5);
  });

  it.each(others)("%s -> %s throws", (from, to) => {
    expect(() => transition(from, to)).toThrow(InvalidTransitionError);
  });
});
