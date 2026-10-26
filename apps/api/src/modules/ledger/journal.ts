import { eq, inArray, sql } from "drizzle-orm";
import type { Tx } from "../../db";
import { journals, ledgerAccounts, ledgerEntries, wallets } from "../../db/schema";
import { newId } from "../../lib/ids";
import { LedgerError } from "./errors";

export type JournalKind = (typeof journals.$inferSelect)["kind"];
export type Journal = typeof journals.$inferSelect;
export type PostedJournal = Journal & { replayed: boolean };

export type JournalLine = { accountId: string; debitCents?: bigint; creditCents?: bigint };

export type PostJournalInput = {
  kind: JournalKind;
  refType?: string;
  refId?: string;
  idempotencyKey: string;
  lines: JournalLine[];
};

export function validateLines(lines: JournalLine[]): void {
  if (lines.length < 2) throw new LedgerError("UNBALANCED", "a journal needs at least two lines");
  let debits = 0n;
  let credits = 0n;
  for (const line of lines) {
    const d = line.debitCents ?? 0n;
    const c = line.creditCents ?? 0n;
    if (d < 0n || c < 0n) throw new LedgerError("INVALID_AMOUNT", `negative amount on ${line.accountId}`);
    if (d > 0n === c > 0n) {
      throw new LedgerError("INVALID_AMOUNT", `line on ${line.accountId} must have exactly one of debit or credit > 0`);
    }
    debits += d;
    credits += c;
  }
  if (debits !== credits) throw new LedgerError("UNBALANCED", `debits ${debits} != credits ${credits}`);
}

export async function findJournal(tx: Tx, idempotencyKey: string): Promise<Journal | undefined> {
  const [row] = await tx.select().from(journals).where(eq(journals.idempotencyKey, idempotencyKey));
  return row;
}

export async function postJournal(tx: Tx, input: PostJournalInput): Promise<PostedJournal> {
  validateLines(input.lines);

  // ON CONFLICT waits for a concurrent writer of the same key, then yields to it.
  const [journal] = await tx
    .insert(journals)
    .values({
      id: newId("jnl"),
      kind: input.kind,
      refType: input.refType,
      refId: input.refId,
      idempotencyKey: input.idempotencyKey,
    })
    .onConflictDoNothing({ target: journals.idempotencyKey })
    .returning();
  if (!journal) {
    const existing = await findJournal(tx, input.idempotencyKey);
    if (!existing) throw new Error(`journal ${input.idempotencyKey} conflicted but was not found`);
    return { ...existing, replayed: true };
  }

  const ids = [...new Set(input.lines.map((l) => l.accountId))];
  const accounts = await tx
    .select({ id: ledgerAccounts.id, ownerId: ledgerAccounts.ownerId })
    .from(ledgerAccounts)
    .where(inArray(ledgerAccounts.id, ids));
  const owners = new Map(accounts.map((a) => [a.id, a.ownerId]));
  const missing = ids.filter((id) => !owners.has(id));
  if (missing.length > 0) throw new LedgerError("UNKNOWN_ACCOUNT", `unknown account(s): ${missing.join(", ")}`);

  await tx.insert(ledgerEntries).values(
    input.lines.map((l) => ({
      id: newId("len"),
      journalId: journal.id,
      accountId: l.accountId,
      debitCents: l.debitCents ?? 0n,
      creditCents: l.creditCents ?? 0n,
    })),
  );

  // Wallet and hold accounts are liabilities owned by a user: their balance moves by credits - debits.
  const deltas = new Map<string, { balance: bigint; held: bigint }>();
  for (const l of input.lines) {
    const ownerId = owners.get(l.accountId);
    // Only wallet and hold accounts feed the wallets cache; an owned receivable does not.
    if (!ownerId || !(l.accountId.startsWith("wallet:") || l.accountId.startsWith("hold:"))) continue;
    const delta = deltas.get(ownerId) ?? { balance: 0n, held: 0n };
    const net = (l.creditCents ?? 0n) - (l.debitCents ?? 0n);
    if (l.accountId.startsWith("hold:")) delta.held += net;
    else delta.balance += net;
    deltas.set(ownerId, delta);
  }
  for (const [ownerId, d] of deltas) {
    const updated = await tx
      .update(wallets)
      .set({
        balanceCents: sql`${wallets.balanceCents} + ${d.balance}::bigint`,
        heldCents: sql`${wallets.heldCents} + ${d.held}::bigint`,
        updatedAt: sql`now()`,
      })
      .where(
        sql`${wallets.ownerId} = ${ownerId}
          and ${wallets.balanceCents} + ${d.balance}::bigint >= 0
          and ${wallets.heldCents} + ${d.held}::bigint >= 0`,
      )
      .returning({ ownerId: wallets.ownerId });
    if (updated.length === 0) {
      throw new LedgerError("INSUFFICIENT_FUNDS", `journal would take wallet of ${ownerId} below zero`);
    }
  }

  return { ...journal, replayed: false };
}
