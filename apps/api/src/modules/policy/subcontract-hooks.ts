// Policy approves, denies and expires subcontract spends, but subcontract rows belong to the arena. The arena
// registers these hooks at startup so policy can tell it, inside the same transaction, without importing arena.
import type { Tx } from "../../db";

export interface SubcontractHooks {
  // The owner approved a pending subcontract spend: its hold stays and the job opens.
  onSubcontractAllowed(tx: Tx, spendRequestId: string, now: Date): Promise<void>;
  // The owner denied it or the approval expired: its hold went back to the wallet.
  onSubcontractReleased(tx: Tx, spendRequestId: string, now: Date): Promise<void>;
}

const noop: SubcontractHooks = { onSubcontractAllowed: async () => {}, onSubcontractReleased: async () => {} };
let current: SubcontractHooks = noop;

export function setSubcontractHooks(hooks: SubcontractHooks): void {
  current = hooks;
}

export function subcontractHooks(): SubcontractHooks {
  return current;
}
