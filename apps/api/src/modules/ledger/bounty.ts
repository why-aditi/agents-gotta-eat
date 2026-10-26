// Bounty settlement journals. The escrow stand-in: the captured reward + fee arrives in paypal:clearing
// (dev escrows move no real money; pm-04 makes the capture real), the reward goes to the winner owner's
// wallet and the fee to platform:fees. Stakes leave stake:{bountyId} as refunds or forfeits.
import type { Tx } from "../../db";
import { ledgerAccounts } from "../../db/schema";
import { PAYPAL_CLEARING, PLATFORM_FEES, stakeAccount, walletAccount } from "./accounts";
import { LedgerError } from "./errors";
import { postJournal, type PostedJournal } from "./journal";

function requirePositive(name: string, cents: bigint) {
  if (cents <= 0n) throw new LedgerError("INVALID_AMOUNT", `${name} must be > 0, got ${cents}`);
}

export async function payBountyReward(
  tx: Tx,
  input: { bountyId: string; winnerOwnerId: string; rewardCents: bigint; feeCents: bigint; idempotencyKey: string },
): Promise<PostedJournal> {
  requirePositive("rewardCents", input.rewardCents);
  if (input.feeCents < 0n) throw new LedgerError("INVALID_AMOUNT", `feeCents must be >= 0, got ${input.feeCents}`);
  const lines = [
    { accountId: PAYPAL_CLEARING, debitCents: input.rewardCents + input.feeCents },
    { accountId: walletAccount(input.winnerOwnerId), creditCents: input.rewardCents },
  ];
  if (input.feeCents > 0n) lines.push({ accountId: PLATFORM_FEES, creditCents: input.feeCents });
  return postJournal(tx, {
    kind: "payout",
    refType: "bounty",
    refId: input.bountyId,
    idempotencyKey: input.idempotencyKey,
    lines,
  });
}

async function ensureStakeAccount(tx: Tx, bountyId: string) {
  await tx
    .insert(ledgerAccounts)
    .values({ id: stakeAccount(bountyId), type: "liability" })
    .onConflictDoNothing();
}

export async function refundStake(
  tx: Tx,
  input: { bountyId: string; entryId: string; ownerId: string; cents: bigint; idempotencyKey: string },
): Promise<PostedJournal> {
  requirePositive("cents", input.cents);
  await ensureStakeAccount(tx, input.bountyId);
  return postJournal(tx, {
    kind: "refund",
    refType: "entry",
    refId: input.entryId,
    idempotencyKey: input.idempotencyKey,
    lines: [
      { accountId: stakeAccount(input.bountyId), debitCents: input.cents },
      { accountId: walletAccount(input.ownerId), creditCents: input.cents },
    ],
  });
}

export async function forfeitStake(
  tx: Tx,
  input: { bountyId: string; entryId: string; cents: bigint; idempotencyKey: string },
): Promise<PostedJournal> {
  requirePositive("cents", input.cents);
  await ensureStakeAccount(tx, input.bountyId);
  return postJournal(tx, {
    kind: "fee",
    refType: "entry",
    refId: input.entryId,
    idempotencyKey: input.idempotencyKey,
    lines: [
      { accountId: stakeAccount(input.bountyId), debitCents: input.cents },
      { accountId: PLATFORM_FEES, creditCents: input.cents },
    ],
  });
}
