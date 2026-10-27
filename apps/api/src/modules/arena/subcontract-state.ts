// The subcontract status machine. Every status change goes through transitionSubcontract().
import type { SubcontractStatus } from "@gottaeat/schemas";

const ALLOWED: Record<SubcontractStatus, readonly SubcontractStatus[]> = {
  // Waiting for the hirer's owner: approval opens it; deny, expiry or the hirer's cancel ends it.
  offered: ["open", "cancelled"],
  open: ["delivered", "declined", "cancelled", "expired"],
  delivered: ["accepted", "rejected"],
  accepted: [],
  rejected: [],
  declined: [],
  cancelled: [],
  expired: [],
};

export class InvalidSubcontractTransitionError extends Error {
  constructor(
    readonly from: SubcontractStatus,
    readonly to: SubcontractStatus,
  ) {
    super(`illegal subcontract transition ${from} -> ${to}`);
    this.name = "InvalidSubcontractTransitionError";
  }
}

export function canTransitionSubcontract(from: SubcontractStatus, to: SubcontractStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function transitionSubcontract(from: SubcontractStatus, to: SubcontractStatus): SubcontractStatus {
  if (!canTransitionSubcontract(from, to)) throw new InvalidSubcontractTransitionError(from, to);
  return to;
}

export const SUBCONTRACT_STATUSES = Object.keys(ALLOWED) as SubcontractStatus[];
