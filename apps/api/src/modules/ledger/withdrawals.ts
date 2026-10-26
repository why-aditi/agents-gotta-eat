// Top-ups and withdrawals. A top-up credits the wallet from paypal:clearing. A withdrawal moves the
// cents out of the wallet into withdrawal:{payoutId} (no owner, so the wallet balance drops at once),
// then either leaves for PayPal (settle) or comes back (return).
import { eq } from "drizzle-orm";
import type { Tx } from "../../db";
import { ledgerAccounts } from "../../db/schema";
import { PAYPAL_CLEARING, walletAccount, withdrawalAccount } from "./accounts";
import { LedgerError } from "./errors";
import { findJournal, postJournal, type PostedJournal } from "./journal";
import { accountBalance, lockWallet } from "./wallets";

function requirePositive(name: string, cents: bigint) {
  if (cents <= 0n) throw new LedgerError("INVALID_AMOUNT", `${name} must be > 0, got ${cents}`);
}

async function ensureWithdrawalAccount(tx: Tx, payoutId: string) {
  await tx
    .insert(ledgerAccounts)
    .values({ id: withdrawalAccount(payoutId), type: "liability" })
    .onConflictDoNothing();
}

// Row lock on the hold account serialises settle and return of one payout. A payout can leave its hold
// once: whatever was held can be settled or returned, never more. Returns the replayed journal, if any.
async function drawFromHold(tx: Tx, payoutId: string, cents: bigint, idempotencyKey: string) {
  const [row] = await tx
    .select()
    .from(ledgerAccounts)
    .where(eq(ledgerAccounts.id, withdrawalAccount(payoutId)))
    .for("update");
  if (!row) throw new LedgerError("UNKNOWN_ACCOUNT", `no withdrawal hold for payout ${payoutId}`);
  const existing = await findJournal(tx, idempotencyKey);
  if (existing) return { ...existing, replayed: true };
  const held = await accountBalance(tx, row.id);
  if (held < cents) {
    throw new LedgerError("INSUFFICIENT_FUNDS", `withdrawal ${payoutId} holds ${held}, needs ${cents}`);
  }
  return undefined;
}

export async function creditTopup(
  tx: Tx,
  input: { topupId: string; ownerId: string; cents: bigint; idempotencyKey: string },
): Promise<PostedJournal> {
  requirePositive("cents", input.cents);
  return postJournal(tx, {
    kind: "topup",
    refType: "topup",
    refId: input.topupId,
    idempotencyKey: input.idempotencyKey,
    lines: [
      { accountId: PAYPAL_CLEARING, debitCents: input.cents },
      { accountId: walletAccount(input.ownerId), creditCents: input.cents },
    ],
  });
}

export async function holdWithdrawal(
  tx: Tx,
  input: { payoutId: string; ownerId: string; cents: bigint; idempotencyKey: string },
): Promise<PostedJournal> {
  requirePositive("cents", input.cents);
  const wallet = await lockWallet(tx, input.ownerId);
  // Checked under the lock, so a replay never trips the balance check below.
  const existing = await findJournal(tx, input.idempotencyKey);
  if (existing) return { ...existing, replayed: true };

  if (wallet.balanceCents < input.cents) {
    throw new LedgerError(
      "INSUFFICIENT_FUNDS",
      `wallet of ${input.ownerId} has ${wallet.balanceCents}, needs ${input.cents}`,
    );
  }
  await ensureWithdrawalAccount(tx, input.payoutId);
  return postJournal(tx, {
    kind: "withdrawal",
    refType: "payout",
    refId: input.payoutId,
    idempotencyKey: input.idempotencyKey,
    lines: [
      { accountId: walletAccount(input.ownerId), debitCents: input.cents },
      { accountId: withdrawalAccount(input.payoutId), creditCents: input.cents },
    ],
  });
}

export async function settleWithdrawal(
  tx: Tx,
  input: { payoutId: string; cents: bigint; idempotencyKey: string },
): Promise<PostedJournal> {
  requirePositive("cents", input.cents);
  const replay = await drawFromHold(tx, input.payoutId, input.cents, input.idempotencyKey);
  if (replay) return replay;
  return postJournal(tx, {
    kind: "payout",
    refType: "payout",
    refId: input.payoutId,
    idempotencyKey: input.idempotencyKey,
    lines: [
      { accountId: withdrawalAccount(input.payoutId), debitCents: input.cents },
      { accountId: PAYPAL_CLEARING, creditCents: input.cents },
    ],
  });
}

export async function returnWithdrawal(
  tx: Tx,
  input: { payoutId: string; ownerId: string; cents: bigint; idempotencyKey: string },
): Promise<PostedJournal> {
  requirePositive("cents", input.cents);
  const replay = await drawFromHold(tx, input.payoutId, input.cents, input.idempotencyKey);
  if (replay) return replay;
  return postJournal(tx, {
    kind: "withdrawal_return",
    refType: "payout",
    refId: input.payoutId,
    idempotencyKey: input.idempotencyKey,
    lines: [
      { accountId: withdrawalAccount(input.payoutId), debitCents: input.cents },
      { accountId: walletAccount(input.ownerId), creditCents: input.cents },
    ],
  });
}
