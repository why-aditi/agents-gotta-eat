// Top-ups, PayPal clawbacks and receivables (pm-04c).
//
// A top-up's charge (credit + fee) arrives in paypal:clearing: the fee goes to platform:fees, the credit first repays
// any open receivable:{owner} and the rest goes to the wallet. A refund or reversal of money a user paid in takes it
// back out of paypal:clearing: from the wallet as far as its balance goes (holds stay untouched), and the rest
// becomes a receivable the user owes. A user with a positive receivable is frozen (see owedCents).
import type { Db, Tx } from "../../db";
import { ledgerAccounts } from "../../db/schema";
import { PAYPAL_CLEARING, PLATFORM_FEES, receivableAccount, walletAccount } from "./accounts";
import { LedgerError } from "./errors";
import { findJournal, postJournal, type JournalLine, type PostedJournal } from "./journal";
import { accountBalance, lockWallet, openWallet } from "./wallets";

function requirePositive(name: string, cents: bigint) {
  if (cents <= 0n) throw new LedgerError("INVALID_AMOUNT", `${name} must be > 0, got ${cents}`);
}

const min = (a: bigint, b: bigint) => (a < b ? a : b);

async function ensureReceivable(tx: Tx, userId: string) {
  await tx
    .insert(ledgerAccounts)
    .values({ id: receivableAccount(userId), type: "asset", ownerId: userId })
    .onConflictDoNothing();
}

// What the user owes the platform (the receivable's asset balance: debits - credits). Zero when none is open.
export async function owedCents(db: Db | Tx, userId: string): Promise<bigint> {
  return -(await accountBalance(db, receivableAccount(userId)));
}

// The top-up's charge (cents + feeCents) arrives in paypal:clearing. The owner's wallet must be open. Once per
// idempotency key.
export async function creditTopup(
  tx: Tx,
  input: { topupId: string; ownerId: string; cents: bigint; feeCents: bigint; idempotencyKey: string },
): Promise<PostedJournal> {
  requirePositive("cents", input.cents);
  if (input.feeCents < 0n) throw new LedgerError("INVALID_AMOUNT", `feeCents must be >= 0, got ${input.feeCents}`);
  // Serialises with clawbacks for the same owner, so the receivable read below stays true until we post.
  await lockWallet(tx, input.ownerId);
  const existing = await findJournal(tx, input.idempotencyKey);
  if (existing) return { ...existing, replayed: true };

  const repay = min(await owedCents(tx, input.ownerId), input.cents);
  const toWallet = input.cents - repay;
  const lines: JournalLine[] = [{ accountId: PAYPAL_CLEARING, debitCents: input.cents + input.feeCents }];
  if (repay > 0n) lines.push({ accountId: receivableAccount(input.ownerId), creditCents: repay });
  if (toWallet > 0n) lines.push({ accountId: walletAccount(input.ownerId), creditCents: toWallet });
  if (input.feeCents > 0n) lines.push({ accountId: PLATFORM_FEES, creditCents: input.feeCents });
  return postJournal(tx, {
    kind: "topup",
    refType: "topup",
    refId: input.topupId,
    idempotencyKey: input.idempotencyKey,
    lines,
  });
}

export interface ClawbackResult {
  // Null when nothing was left to claw back (the top-up's whole charge was already taken back).
  journal: PostedJournal | null;
  // What this call took back: 0 on a replay or when nothing was left.
  clawedCents: bigint;
  // What the user owes in total afterwards.
  owedCents: bigint;
}

// A PayPal refund or reversal of `cents` of a top-up. `alreadyClawedCents` is what earlier refunds of the same
// top-up took back; the total never exceeds the charge (creditCents + feeCents). The first creditCents clawed are
// the credit part (wallet, then receivable); anything beyond is the fee part (taken from platform:fees).
export async function clawbackTopup(
  tx: Tx,
  input: {
    topupId: string;
    ownerId: string;
    cents: bigint;
    creditCents: bigint;
    feeCents: bigint;
    alreadyClawedCents: bigint;
    idempotencyKey: string;
  },
): Promise<ClawbackResult> {
  requirePositive("cents", input.cents);
  const wallet = await lockWallet(tx, input.ownerId);
  const existing = await findJournal(tx, input.idempotencyKey);
  if (existing) {
    return { journal: { ...existing, replayed: true }, clawedCents: 0n, owedCents: await owedCents(tx, input.ownerId) };
  }
  const left = input.creditCents + input.feeCents - input.alreadyClawedCents;
  const clawed = min(input.cents, left);
  if (clawed <= 0n) return { journal: null, clawedCents: 0n, owedCents: await owedCents(tx, input.ownerId) };

  const creditLeft = input.creditCents - input.alreadyClawedCents;
  const creditPart = creditLeft > 0n ? min(clawed, creditLeft) : 0n;
  const feePart = clawed - creditPart;
  const fromWallet = min(wallet.balanceCents > 0n ? wallet.balanceCents : 0n, creditPart);
  const owed = creditPart - fromWallet;

  const lines: JournalLine[] = [{ accountId: PAYPAL_CLEARING, creditCents: clawed }];
  if (fromWallet > 0n) lines.push({ accountId: walletAccount(input.ownerId), debitCents: fromWallet });
  if (owed > 0n) {
    await ensureReceivable(tx, input.ownerId);
    lines.push({ accountId: receivableAccount(input.ownerId), debitCents: owed });
  }
  if (feePart > 0n) lines.push({ accountId: PLATFORM_FEES, debitCents: feePart });
  const journal = await postJournal(tx, {
    kind: "clawback",
    refType: "topup",
    refId: input.topupId,
    idempotencyKey: input.idempotencyKey,
    lines,
  });
  return { journal, clawedCents: clawed, owedCents: await owedCents(tx, input.ownerId) };
}

// A PayPal refund or reversal of a bounty's escrow capture after the winner was paid: the winner keeps the reward,
// and the poster owes the platform `cents`. Opens the poster's wallet (so a top-up can repay it). Once per key.
export async function clawbackEscrow(
  tx: Tx,
  input: { bountyId: string; posterId: string; cents: bigint; idempotencyKey: string },
): Promise<ClawbackResult> {
  requirePositive("cents", input.cents);
  await openWallet(tx, input.posterId);
  await lockWallet(tx, input.posterId);
  const existing = await findJournal(tx, input.idempotencyKey);
  if (existing) {
    return {
      journal: { ...existing, replayed: true },
      clawedCents: 0n,
      owedCents: await owedCents(tx, input.posterId),
    };
  }
  await ensureReceivable(tx, input.posterId);
  const journal = await postJournal(tx, {
    kind: "clawback",
    refType: "bounty",
    refId: input.bountyId,
    idempotencyKey: input.idempotencyKey,
    lines: [
      { accountId: receivableAccount(input.posterId), debitCents: input.cents },
      { accountId: PAYPAL_CLEARING, creditCents: input.cents },
    ],
  });
  return { journal, clawedCents: input.cents, owedCents: await owedCents(tx, input.posterId) };
}
