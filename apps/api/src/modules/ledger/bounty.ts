// Bounty settlement journals. The escrow stand-in: the captured reward + fee arrives in paypal:clearing
// (dev escrows move no real money; pm-04 makes the capture real), the reward goes to the winner owner's
// wallet and the fee to platform:fees. Stakes leave stake:{bountyId} as refunds or forfeits.
import { eq } from "drizzle-orm";
import type { Tx } from "../../db";
import { ledgerAccounts } from "../../db/schema";
import { disputeHoldAccount, PAYPAL_CLEARING, PLATFORM_FEES, stakeAccount, walletAccount } from "./accounts";
import { LedgerError } from "./errors";
import { findJournal, postJournal, type PostedJournal } from "./journal";
import { accountBalance, lockWallet } from "./wallets";

function requirePositive(name: string, cents: bigint) {
  if (cents <= 0n) throw new LedgerError("INVALID_AMOUNT", `${name} must be > 0, got ${cents}`);
}

// With holdForDispute (auto-judged bounties, disp-01) the reward waits in hold:dispute:{bountyId}, still owned by the
// winner's owner, until releaseDisputeHold or refundDisputedReward.
export async function payBountyReward(
  tx: Tx,
  input: {
    bountyId: string;
    winnerOwnerId: string;
    rewardCents: bigint;
    feeCents: bigint;
    idempotencyKey: string;
    holdForDispute?: boolean;
  },
): Promise<PostedJournal> {
  requirePositive("rewardCents", input.rewardCents);
  if (input.feeCents < 0n) throw new LedgerError("INVALID_AMOUNT", `feeCents must be >= 0, got ${input.feeCents}`);
  let rewardAccount = walletAccount(input.winnerOwnerId);
  if (input.holdForDispute) {
    rewardAccount = disputeHoldAccount(input.bountyId);
    await tx
      .insert(ledgerAccounts)
      .values({ id: rewardAccount, type: "liability", ownerId: input.winnerOwnerId })
      .onConflictDoNothing();
  }
  const lines = [
    { accountId: PAYPAL_CLEARING, debitCents: input.rewardCents + input.feeCents },
    { accountId: rewardAccount, creditCents: input.rewardCents },
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

// The open dispute hold of a bounty, with its owner's wallet (and `alsoLock`'s) locked in id order. Null on a replay.
type OpenDisputeHold = { replay: PostedJournal } | { holdId: string; ownerId: string; balance: bigint };

async function openDisputeHold(
  tx: Tx,
  bountyId: string,
  idempotencyKey: string,
  alsoLock?: string,
): Promise<OpenDisputeHold> {
  const holdId = disputeHoldAccount(bountyId);
  const [account] = await tx.select().from(ledgerAccounts).where(eq(ledgerAccounts.id, holdId));
  if (!account?.ownerId) throw new LedgerError("UNKNOWN_ACCOUNT", `no dispute hold ${holdId}`);
  for (const ownerId of [...new Set([account.ownerId, alsoLock ?? account.ownerId])].sort()) {
    await lockWallet(tx, ownerId);
  }
  const existing = await findJournal(tx, idempotencyKey);
  if (existing) return { replay: { ...existing, replayed: true } };
  const balance = await accountBalance(tx, holdId);
  if (balance <= 0n) throw new LedgerError("HOLD_NOT_OPEN", `dispute hold ${holdId} is closed`);
  return { holdId, ownerId: account.ownerId, balance };
}

// The dispute window passed, or an admin upheld the result: the reward moves to the winner's owner's wallet.
export async function releaseDisputeHold(
  tx: Tx,
  input: { bountyId: string; idempotencyKey: string },
): Promise<PostedJournal> {
  const h = await openDisputeHold(tx, input.bountyId, input.idempotencyKey);
  if ("replay" in h) return h.replay;
  return postJournal(tx, {
    kind: "release",
    refType: "bounty",
    refId: input.bountyId,
    idempotencyKey: input.idempotencyKey,
    lines: [
      { accountId: h.holdId, debitCents: h.balance },
      { accountId: walletAccount(h.ownerId), creditCents: h.balance },
    ],
  });
}

// An admin overturned the result: the held reward goes back to the poster. A real escrow was refunded through
// PayPal, so the money leaves through paypal:clearing; a dev escrow credits the poster's wallet. The fee stays.
export async function refundDisputedReward(
  tx: Tx,
  input: { bountyId: string; posterId: string; toPosterWallet: boolean; idempotencyKey: string },
): Promise<PostedJournal> {
  const h = await openDisputeHold(
    tx,
    input.bountyId,
    input.idempotencyKey,
    input.toPosterWallet ? input.posterId : undefined,
  );
  if ("replay" in h) return h.replay;
  return postJournal(tx, {
    kind: "refund",
    refType: "bounty",
    refId: input.bountyId,
    idempotencyKey: input.idempotencyKey,
    lines: [
      { accountId: h.holdId, debitCents: h.balance },
      { accountId: input.toPosterWallet ? walletAccount(input.posterId) : PAYPAL_CLEARING, creditCents: h.balance },
    ],
  });
}
