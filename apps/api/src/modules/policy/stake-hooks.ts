// Policy settles and releases stake spends, but entries belong to the arena module. The arena registers
// these hooks at startup so policy can tell it, inside the same transaction, without importing arena.
import type { Tx } from "../../db";

export interface StakeHooks {
  // The stake left the wallet for stake:{bountyId} (allowed at once, or approved by the owner).
  onStakeSettled(tx: Tx, spendRequestId: string): Promise<void>;
  // The stake's hold went back to the wallet (owner denied it, or it expired).
  onStakeReleased(tx: Tx, spendRequestId: string): Promise<void>;
}

const noop: StakeHooks = { onStakeSettled: async () => {}, onStakeReleased: async () => {} };
let current: StakeHooks = noop;

export function setStakeHooks(hooks: StakeHooks): void {
  current = hooks;
}

export function stakeHooks(): StakeHooks {
  return current;
}
