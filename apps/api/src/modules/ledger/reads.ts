// Read-only views of the ledger for the admin dashboard. The ledger module owns these tables, so every read
// of journals, entries and accounts outside the money paths lives here.
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../../db";
import { journals, ledgerAccounts, ledgerEntries, wallets } from "../../db/schema";
import { PAYPAL_CLEARING } from "./accounts";
import type { JournalKind } from "./journal";

export const JOURNAL_PAGE_DEFAULT = 100;
export const JOURNAL_PAGE_MAX = 200;

export type AccountType = (typeof ledgerAccounts.$inferSelect)["type"];

export type JournalSummary = {
  id: string;
  kind: JournalKind;
  refType: string | null;
  refId: string | null;
  idempotencyKey: string;
  totalCents: bigint;
  lineCount: number;
  createdAt: Date;
};

export type JournalPage = { items: JournalSummary[]; nextCursor: string | null };

export type JournalDetailLine = {
  id: string;
  accountId: string;
  accountType: AccountType;
  ownerId: string | null;
  debitCents: bigint;
  creditCents: bigint;
};

export type JournalDetail = Omit<JournalSummary, "lineCount"> & { lines: JournalDetailLine[] };

export type AccountView = {
  id: string;
  type: AccountType;
  ownerId: string | null;
  memo: boolean;
  // Natural balance from the entries: debits - credits for assets, credits - debits otherwise.
  balanceCents: bigint;
  // The wallets cache, for wallet accounts only.
  cachedBalanceCents: bigint | null;
  createdAt: Date;
};

// The cursor carries created_at at Postgres's microsecond precision as text: a JS Date would round it to
// milliseconds and skip or repeat rows.
const CursorShape = z.object({
  t: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/),
  id: z.string().min(1).max(64),
});
type Cursor = z.infer<typeof CursorShape>;

export function encodeJournalCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

// Null when the cursor is not one we issued.
export function decodeJournalCursor(cursor: string): Cursor | null {
  if (!/^[A-Za-z0-9_-]{1,400}$/.test(cursor)) return null;
  try {
    const parsed = CursorShape.safeParse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const createdAtText = sql<string>`to_char(${journals.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
const totalDebits = sql<string>`coalesce(sum(${ledgerEntries.debitCents}), 0)::bigint`;

// Newest first, ordered by (created_at desc, id desc) so equal timestamps still page without gaps.
export async function listJournals(
  db: Db,
  opts: { cursor?: string; limit?: number; kind?: JournalKind } = {},
): Promise<JournalPage> {
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? JOURNAL_PAGE_DEFAULT), 1), JOURNAL_PAGE_MAX);
  const where: SQL[] = [];
  if (opts.kind) where.push(eq(journals.kind, opts.kind));
  if (opts.cursor !== undefined) {
    const c = decodeJournalCursor(opts.cursor);
    if (!c) throw new RangeError("invalid journal cursor");
    where.push(sql`(${journals.createdAt}, ${journals.id}) < (${c.t}::timestamptz, ${c.id})`);
  }
  const rows = await db
    .select({
      id: journals.id,
      kind: journals.kind,
      refType: journals.refType,
      refId: journals.refId,
      idempotencyKey: journals.idempotencyKey,
      createdAt: journals.createdAt,
      createdAtText,
      totalCents: totalDebits,
      lineCount: sql<number>`count(${ledgerEntries.id})::int`,
    })
    .from(journals)
    .leftJoin(ledgerEntries, eq(ledgerEntries.journalId, journals.id))
    .where(where.length > 0 ? and(...where) : undefined)
    .groupBy(journals.id)
    .orderBy(desc(journals.createdAt), desc(journals.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page.map((r) => ({
      id: r.id,
      kind: r.kind,
      refType: r.refType,
      refId: r.refId,
      idempotencyKey: r.idempotencyKey,
      totalCents: BigInt(r.totalCents),
      lineCount: r.lineCount,
      createdAt: r.createdAt,
    })),
    nextCursor: rows.length > limit && last ? encodeJournalCursor({ t: last.createdAtText, id: last.id }) : null,
  };
}

export async function getJournal(db: Db, id: string): Promise<JournalDetail | null> {
  const [journal] = await db.select().from(journals).where(eq(journals.id, id));
  if (!journal) return null;
  const lines = await db
    .select({
      id: ledgerEntries.id,
      accountId: ledgerEntries.accountId,
      accountType: ledgerAccounts.type,
      ownerId: ledgerAccounts.ownerId,
      debitCents: ledgerEntries.debitCents,
      creditCents: ledgerEntries.creditCents,
    })
    .from(ledgerEntries)
    .innerJoin(ledgerAccounts, eq(ledgerAccounts.id, ledgerEntries.accountId))
    .where(eq(ledgerEntries.journalId, id))
    // Debits first, then by id, so the order is stable.
    .orderBy(desc(sql`${ledgerEntries.debitCents} > 0`), asc(ledgerEntries.id));
  const totalCents = lines.reduce((sum, l) => sum + l.debitCents, 0n);
  return {
    id: journal.id,
    kind: journal.kind,
    refType: journal.refType,
    refId: journal.refId,
    idempotencyKey: journal.idempotencyKey,
    totalCents,
    createdAt: journal.createdAt,
    lines,
  };
}

// Every account with its balance computed from the entries, and the wallets cache next to wallet accounts.
export async function listAccounts(db: Db): Promise<AccountView[]> {
  const rows = await db
    .select({
      id: ledgerAccounts.id,
      type: ledgerAccounts.type,
      ownerId: ledgerAccounts.ownerId,
      memo: ledgerAccounts.memo,
      createdAt: ledgerAccounts.createdAt,
      debits: sql<string>`coalesce(sum(${ledgerEntries.debitCents}), 0)::bigint`,
      credits: sql<string>`coalesce(sum(${ledgerEntries.creditCents}), 0)::bigint`,
      cached: sql<string | null>`(select ${wallets.balanceCents}::text from ${wallets}
        where ${ledgerAccounts.id} = 'wallet:' || ${wallets.ownerId})`,
    })
    .from(ledgerAccounts)
    .leftJoin(ledgerEntries, eq(ledgerEntries.accountId, ledgerAccounts.id))
    .groupBy(ledgerAccounts.id)
    .orderBy(asc(ledgerAccounts.id));
  return rows.map((r) => {
    const debits = BigInt(r.debits);
    const credits = BigInt(r.credits);
    return {
      id: r.id,
      type: r.type,
      ownerId: r.ownerId,
      memo: r.memo,
      balanceCents: r.type === "asset" ? debits - credits : credits - debits,
      cachedBalanceCents: r.cached === null ? null : BigInt(r.cached),
      createdAt: r.createdAt,
    };
  });
}

// A journal's net movement on paypal:clearing: debits minus credits, so positive is money PayPal took in for us
// (a capture) and negative is money that left through PayPal (a payout, a refund).
export type ClearingMovement = {
  journalId: string;
  kind: JournalKind;
  refType: string | null;
  refId: string | null;
  idempotencyKey: string;
  netCents: bigint;
  createdAt: Date;
};

// Every journal touching paypal:clearing created in [from, to), oldest first. For PayPal reconciliation.
export async function clearingMovements(db: Db, opts: { from: Date; to: Date }): Promise<ClearingMovement[]> {
  const rows = await db
    .select({
      journalId: journals.id,
      kind: journals.kind,
      refType: journals.refType,
      refId: journals.refId,
      idempotencyKey: journals.idempotencyKey,
      createdAt: journals.createdAt,
      net: sql<string>`sum(${ledgerEntries.debitCents} - ${ledgerEntries.creditCents})::bigint`,
    })
    .from(journals)
    .innerJoin(ledgerEntries, eq(ledgerEntries.journalId, journals.id))
    .where(
      and(
        eq(ledgerEntries.accountId, PAYPAL_CLEARING),
        sql`${journals.createdAt} >= ${opts.from.toISOString()}::timestamptz`,
        sql`${journals.createdAt} < ${opts.to.toISOString()}::timestamptz`,
      ),
    )
    .groupBy(journals.id)
    .orderBy(asc(journals.createdAt), asc(journals.id));
  return rows.map((r) => ({
    journalId: r.journalId,
    kind: r.kind,
    refType: r.refType,
    refId: r.refId,
    idempotencyKey: r.idempotencyKey,
    netCents: BigInt(r.net),
    createdAt: r.createdAt,
  }));
}

export const JOURNALS_FOR_REF_LIMIT = 50;

// The journals of one reference (e.g. "topup", "tup_..."), oldest first, with their totals. At most 50.
export async function journalsForRef(db: Db, refType: string, refId: string): Promise<JournalSummary[]> {
  const rows = await db
    .select({
      id: journals.id,
      kind: journals.kind,
      refType: journals.refType,
      refId: journals.refId,
      idempotencyKey: journals.idempotencyKey,
      createdAt: journals.createdAt,
      totalCents: totalDebits,
      lineCount: sql<number>`count(${ledgerEntries.id})::int`,
    })
    .from(journals)
    .leftJoin(ledgerEntries, eq(ledgerEntries.journalId, journals.id))
    .where(and(eq(journals.refType, refType), eq(journals.refId, refId)))
    .groupBy(journals.id)
    .orderBy(asc(journals.createdAt), asc(journals.id))
    .limit(JOURNALS_FOR_REF_LIMIT);
  return rows.map((r) => ({ ...r, totalCents: BigInt(r.totalCents) }));
}
