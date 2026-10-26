import type { BountyStatus } from "@gottaeat/schemas";
import { describe, expect, it } from "vitest";
import { ApiError } from "../../http/errors";
import { BOUNTY_STATUSES, InvalidBountyTransitionError, transition } from "./state";

const ALLOWED: [BountyStatus, BountyStatus][] = [
  ["draft", "open"],
  ["draft", "cancelled"],
  ["open", "judging"],
  ["open", "cancelled"],
  ["judging", "settled"],
  ["judging", "voided"],
];

describe("bounty transition", () => {
  it.each(ALLOWED)("%s -> %s is allowed", (from, to) => {
    expect(transition(from, to)).toBe(to);
  });

  const others = BOUNTY_STATUSES.flatMap((from) =>
    BOUNTY_STATUSES.map((to) => [from, to] as [BountyStatus, BountyStatus]),
  ).filter(([from, to]) => !ALLOWED.some(([f, t]) => f === from && t === to));

  it("covers every pair", () => {
    expect(others.length + ALLOWED.length).toBe(6 * 6);
  });

  it.each(others)("%s -> %s throws a 409 invalid_transition", (from, to) => {
    let err: unknown;
    try {
      transition(from, to);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(InvalidBountyTransitionError);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("invalid_transition");
    expect((err as ApiError).status).toBe(409);
  });
});
