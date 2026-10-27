import { eq, sql } from "drizzle-orm";
import type { Db, Tx } from "../../db";
import { ledgerAccounts, ledgerEntries, wallets } from "../../db/schema";
import { holdAccount, PAYPAL_CLEARING, PLATFORM_FEES, stakeAccount, walletAccount } from "./accounts";
import { LedgerError } from "./errors";
import { findJournal, lockedWallets, postJournal, type JournalLine, type PostedJournal } from "./journal";

export async function openWallet(tx: Tx, ownerId: string): Promise<void> {
  await tx.insert(wallets).values({ ownerId }).onConflictDoNothing();
  await tx
    .insert(ledgerAccounts)
    .values({ id: walletAccount(ownerId), type: "liability", ownerId })
    .onConflictDoNothing();
}

// Dev and demo money until PayPal top-ups (pm-04): paypal:clearing → the owner's wallet. Opens the wallet if
// needed. Once per idempotency key: a replay returns the first journal.
export async function devCredit(
  tx: Tx,
  input: { ownerId: string; amountCents: bigint; idempotencyKey: string },
): Promise<PostedJournal> {
  requirePositive("amountCents", input.amountCents);
  await openWallet(tx, input.ownerId);
  return postJournal(tx, {
    kind: "topup",
    refType: "dev_credit",
    refId: input.ownerId,
    idempotencyKey: input.idempotencyKey,
    lines: [
      { accountId: PAYPAL_CLEARING, debitCents: input.amountCents },
      { accountId: walletAccount(input.ownerId), creditCents: input.amountCents },
    ],
  });
}

// Row lock that serialises every balance check and hold change for one owner. Callers outside the
// ledger (the policy engine) take it first so their own checks run under the same lock as the hold.
// A row locked once stays locked until the transaction ends, so a second call in the same transaction returns
// the remembered row (kept current by postJournal) instead of asking Postgres again (perf-01).
export async function lockWallet(tx: Tx, ownerId: string) {
  const remembered = lockedWallets(tx)?.get(ownerId);
  if (remembered) return remembered;
  const [row] = await tx.select().from(wallets).where(eq(wallets.ownerId, ownerId)).for("update");
  if (!row) throw new LedgerError("UNKNOWN_ACCOUNT", `no wallet for ${ownerId}`);
  lockedWallets(tx)?.set(ownerId, row);
  return row;
}

// Liability balance (credits - debits) straight from the entries.
export async function accountBalance(db: Db | Tx, accountId: string): Promise<bigint> {
  const [row] = await db
    .select({
      balance: sql<string>`coalesce(sum(${ledgerEntries.creditCents} - ${ledgerEntries.debitCents}), 0)::bigint`,
    })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.accountId, accountId));
  return BigInt(row?.balance ?? 0);
}

function requirePositive(name: string, cents: bigint) {
  if (cents <= 0n) throw new LedgerError("INVALID_AMOUNT", `${name} must be > 0, got ${cents}`);
}

export async function hold(
  tx: Tx,
  // fresh: the key belongs to a spend request minted in this transaction, so there is nothing to replay; the
  // lookup is skipped and the unique index on journals.idempotency_key stays the backstop (perf-01).
  input: { ownerId: string; spendRequestId: string; amountCents: bigint; idempotencyKey: string; fresh?: boolean },
): Promise<PostedJournal> {
  requirePositive("amountCents", input.amountCents);
  const wallet = await lockWallet(tx, input.ownerId);
  // Checked under the lock, so a replay never trips the balance check below.
  const existing = input.fresh ? undefined : await findJournal(tx, input.idempotencyKey);
  if (existing) return { ...existing, replayed: true };

  if (wallet.balanceCents < input.amountCents) {
    throw new LedgerError(
      "INSUFFICIENT_FUNDS",
      `wallet of ${input.ownerId} has ${wallet.balanceCents}, needs ${input.amountCents}`,
    );
  }
  const holdId = holdAccount(input.spendRequestId);
  await tx
    .insert(ledgerAccounts)
    .values({ id: holdId, type: "liability", ownerId: input.ownerId })
    .onConflictDoNothing();
  return postJournal(tx, {
    kind: "hire",
    refType: "spend_request",
    refId: input.spendRequestId,
    idempotencyKey: input.idempotencyKey,
    lines: [
      { accountId: walletAccount(input.ownerId), debitCents: input.amountCents },
      { accountId: holdId, creditCents: input.amountCents },
    ],
  });
}

// Locks the hold owner's wallet (and the payee's, in id order so two opposite settles can't deadlock),
// then returns the open hold balance, or the replayed journal.
type OpenHold = { replay: PostedJournal } | { holdId: string; ownerId: string; balance: bigint };

async function openHold(
  tx: Tx,
  spendRequestId: string,
  idempotencyKey: string,
  payeeOwnerId?: string,
  fresh?: boolean,
): Promise<OpenHold> {
  const holdId = holdAccount(spendRequestId);
  const [account] = await tx.select().from(ledgerAccounts).where(eq(ledgerAccounts.id, holdId));
  if (!account?.ownerId) throw new LedgerError("UNKNOWN_ACCOUNT", `no hold ${holdId}`);
  const owners = [...new Set([account.ownerId, payeeOwnerId ?? account.ownerId])].sort();
  for (const ownerId of owners) await lockWallet(tx, ownerId);
  const existing = fresh ? undefined : await findJournal(tx, idempotencyKey);
  if (existing) return { replay: { ...existing, replayed: true } };
  const balance = await accountBalance(tx, holdId);
  if (balance <= 0n) throw new LedgerError("HOLD_NOT_OPEN", `hold ${holdId} is closed`);
  return { holdId, ownerId: account.ownerId, balance };
}

export async function settle(
  tx: Tx,
  input: {
    spendRequestId: string;
    payeeOwnerId: string;
    amountCents: bigint;
    feeCents: bigint;
    idempotencyKey: string;
    // As for hold: the settle of a spend created in this transaction.
    fresh?: boolean;
  },
): Promise<PostedJournal> {
  requirePositive("amountCents", input.amountCents);
  if (input.feeCents < 0n) throw new LedgerError("INVALID_AMOUNT", `feeCents must be >= 0, got ${input.feeCents}`);
  const h = await openHold(tx, input.spendRequestId, input.idempotencyKey, input.payeeOwnerId, input.fresh);
  if ("replay" in h) return h.replay;
  const total = input.amountCents + input.feeCents;
  if (total !== h.balance) {
    throw new LedgerError("INVALID_AMOUNT", `amount + fee ${total} != hold balance ${h.balance}`);
  }
  const lines: JournalLine[] = [
    { accountId: h.holdId, debitCents: total },
    { accountId: walletAccount(input.payeeOwnerId), creditCents: input.amountCents },
  ];
  if (input.feeCents > 0n) lines.push({ accountId: PLATFORM_FEES, creditCents: input.feeCents });
  return postJournal(tx, {
    kind: "settle",
    refType: "spend_request",
    refId: input.spendRequestId,
    idempotencyKey: input.idempotencyKey,
    lines,
  });
}

export async function release(
  tx: Tx,
  input: { spendRequestId: string; idempotencyKey: string },
): Promise<PostedJournal> {
  const h = await openHold(tx, input.spendRequestId, input.idempotencyKey);
  if ("replay" in h) return h.replay;
  return postJournal(tx, {
    kind: "release",
    refType: "spend_request",
    refId: input.spendRequestId,
    idempotencyKey: input.idempotencyKey,
    lines: [
      { accountId: h.holdId, debitCents: h.balance },
      { accountId: walletAccount(h.ownerId), creditCents: h.balance },
    ],
  });
}

// Moves a whole open hold into the bounty's stake account, where it waits for judging (refund or forfeit).
export async function stakeFromHold(
  tx: Tx,
  input: { spendRequestId: string; bountyId: string; idempotencyKey: string; fresh?: boolean },
): Promise<PostedJournal> {
  const h = await openHold(tx, input.spendRequestId, input.idempotencyKey, undefined, input.fresh);
  if ("replay" in h) return h.replay;
  const stakeId = stakeAccount(input.bountyId);
  await tx.insert(ledgerAccounts).values({ id: stakeId, type: "liability" }).onConflictDoNothing();
  return postJournal(tx, {
    kind: "stake",
    refType: "spend_request",
    refId: input.spendRequestId,
    idempotencyKey: input.idempotencyKey,
    lines: [
      { accountId: h.holdId, debitCents: h.balance },
      { accountId: stakeId, creditCents: h.balance },
    ],
  });
}
