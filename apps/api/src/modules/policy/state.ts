// The spend request status machine. Every status change goes through transition().
import type { SpendStatus } from "@gottaeat/schemas";

export type SpendFrom = SpendStatus | "new";

const ALLOWED: Record<SpendFrom, readonly SpendStatus[]> = {
  new: ["denied", "settled", "allowed", "pending_approval"],
  pending_approval: ["settled", "allowed", "released"],
  // Taken by the subcontract slice.
  allowed: ["settled", "released"],
  settled: [],
  denied: [],
  released: [],
};

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: SpendFrom,
    readonly to: SpendStatus,
  ) {
    super(`illegal spend request transition ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function transition(from: SpendFrom, to: SpendStatus): SpendStatus {
  if (!ALLOWED[from].includes(to)) throw new InvalidTransitionError(from, to);
  return to;
}

export const SPEND_STATUSES: readonly SpendFrom[] = Object.keys(ALLOWED) as SpendFrom[];
