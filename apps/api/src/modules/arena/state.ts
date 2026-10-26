// The bounty status machine. Every bounty status change goes through transition().
import type { BountyStatus } from "@gottaeat/schemas";
import { ApiError } from "../../http/errors";

const ALLOWED: Record<BountyStatus, readonly BountyStatus[]> = {
  draft: ["open", "cancelled"],
  open: ["judging", "cancelled"],
  judging: ["settled", "voided"],
  settled: [],
  voided: [],
  cancelled: [],
};

export const BOUNTY_STATUSES = Object.keys(ALLOWED) as BountyStatus[];

// A 409 invalid_transition when it reaches a route.
export class InvalidBountyTransitionError extends ApiError {
  constructor(
    readonly from: BountyStatus,
    readonly to: BountyStatus,
  ) {
    super("invalid_transition", `A ${from} bounty cannot become ${to}`, { from, to });
    this.name = "InvalidBountyTransitionError";
  }
}

export function transition(from: BountyStatus, to: BountyStatus): BountyStatus {
  if (!ALLOWED[from].includes(to)) throw new InvalidBountyTransitionError(from, to);
  return to;
}
