import { describe, expect, it } from "vitest";
import {
  canTransitionSubcontract,
  InvalidSubcontractTransitionError,
  SUBCONTRACT_STATUSES,
  transitionSubcontract,
} from "./subcontract-state";

const LEGAL = [
  ["offered", "open"],
  ["offered", "cancelled"],
  ["open", "delivered"],
  ["open", "declined"],
  ["open", "cancelled"],
  ["open", "expired"],
  ["delivered", "accepted"],
  ["delivered", "rejected"],
] as const;

describe("transitionSubcontract", () => {
  it("allows exactly the lifecycle's moves", () => {
    for (const from of SUBCONTRACT_STATUSES) {
      for (const to of SUBCONTRACT_STATUSES) {
        const legal = LEGAL.some(([f, t]) => f === from && t === to);
        expect(canTransitionSubcontract(from, to), `${from} -> ${to}`).toBe(legal);
        if (legal) expect(transitionSubcontract(from, to)).toBe(to);
        else expect(() => transitionSubcontract(from, to)).toThrow(InvalidSubcontractTransitionError);
      }
    }
  });

  it("names the illegal move", () => {
    expect(() => transitionSubcontract("accepted", "rejected")).toThrow(
      "illegal subcontract transition accepted -> rejected",
    );
  });
});
