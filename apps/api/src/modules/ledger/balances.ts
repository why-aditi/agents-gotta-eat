import { and, eq, like, sql } from "drizzle-orm";
import type { Db, Tx } from "../../db";
import { ledgerAccounts, ledgerEntries } from "../../db/schema";
import { walletAccount } from "./accounts";
import { accountBalance } from "./wallets";

export type Balances = { balanceCents: bigint; heldCents: bigint };

// Computed from ledger_entries, not the wallets cache.
export async function getBalances(db: Db | Tx, ownerId: string): Promise<Balances> {
  const balanceCents = await accountBalance(db, walletAccount(ownerId));
  const [held] = await db
    .select({
      cents: sql<string>`coalesce(sum(${ledgerEntries.creditCents} - ${ledgerEntries.debitCents}), 0)::bigint`,
    })
    .from(ledgerEntries)
    .innerJoin(ledgerAccounts, eq(ledgerAccounts.id, ledgerEntries.accountId))
    .where(and(eq(ledgerAccounts.ownerId, ownerId), like(ledgerAccounts.id, "hold:%")));
  return { balanceCents, heldCents: BigInt(held?.cents ?? 0) };
}

export type ReconcileCheck = { name: string; ok: boolean; detail: string };
export type ReconcileResult = { ok: boolean; checks: ReconcileCheck[] };

async function rows<T>(db: Db | Tx, query: ReturnType<typeof sql>): Promise<T[]> {
  const res = await db.execute(query);
  return res.rows as T[];
}

export async function reconcile(db: Db | Tx): Promise<ReconcileResult> {
  const unbalanced = await rows<{ id: string }>(
    db,
    sql`select j.id from journals j left join ledger_entries e on e.journal_id = j.id
        group by j.id
        having count(e.id) < 2 or coalesce(sum(e.debit_cents), 0) <> coalesce(sum(e.credit_cents), 0)
        limit 10`,
  );

  const [total] = await rows<{ net: string }>(
    db,
    sql`select coalesce(sum(e.debit_cents - e.credit_cents), 0)::bigint as net
        from ledger_entries e join ledger_accounts a on a.id = e.account_id
        where not a.memo`,
  );
  const net = BigInt(total?.net ?? 0);

  // Ledger-side balance and held total per wallet owner, compared with the cache.
  const perOwner = await rows<{
    owner_id: string;
    cached_balance: string;
    cached_held: string;
    balance: string;
    held: string;
  }>(
    db,
    sql`with owned as (
          select a.owner_id,
                 coalesce(sum(e.credit_cents - e.debit_cents) filter (where a.id like 'wallet:%'), 0)::bigint as balance,
                 coalesce(sum(e.credit_cents - e.debit_cents) filter (where a.id like 'hold:%'), 0)::bigint as held
          from ledger_accounts a left join ledger_entries e on e.account_id = a.id
          where a.owner_id is not null
          group by a.owner_id
        )
        select w.owner_id, w.balance_cents as cached_balance, w.held_cents as cached_held,
               coalesce(o.balance, 0) as balance, coalesce(o.held, 0) as held
        from wallets w full join owned o on o.owner_id = w.owner_id`,
  );
  const mismatched = perOwner.filter(
    (r) =>
      r.cached_balance === null ||
      BigInt(r.cached_balance) !== BigInt(r.balance) ||
      BigInt(r.cached_held) !== BigInt(r.held),
  );

  const negative = await rows<{ id: string; balance: string }>(
    db,
    sql`select a.id, sum(e.credit_cents - e.debit_cents)::bigint as balance
        from ledger_accounts a join ledger_entries e on e.account_id = a.id
        where a.id like 'wallet:%' or a.id like 'hold:%'
        group by a.id
        having sum(e.credit_cents - e.debit_cents) < 0
        limit 10`,
  );

  // Informational: who owes the platform money after a PayPal refund or reversal. Never fails.
  const owing = await rows<{ id: string; owed: string }>(
    db,
    sql`select a.id, sum(e.debit_cents - e.credit_cents)::bigint as owed
        from ledger_accounts a join ledger_entries e on e.account_id = a.id
        where a.id like 'receivable:%'
        group by a.id
        having sum(e.debit_cents - e.credit_cents) <> 0
        order by a.id`,
  );

  const checks: ReconcileCheck[] = [
    {
      name: "journals_balanced",
      ok: unbalanced.length === 0,
      detail:
        unbalanced.length === 0 ? "all journals balanced" : `unbalanced: ${unbalanced.map((r) => r.id).join(", ")}`,
    },
    {
      name: "zero_sum",
      ok: net === 0n,
      detail: `sum of debits - credits over non-memo accounts = ${net}`,
    },
    {
      name: "wallet_cache",
      ok: mismatched.length === 0,
      detail:
        mismatched.length === 0
          ? `${perOwner.length} wallets match the ledger`
          : mismatched
              .slice(0, 10)
              .map((r) => `${r.owner_id}: cache ${r.cached_balance}/${r.cached_held}, ledger ${r.balance}/${r.held}`)
              .join("; "),
    },
    {
      name: "no_negative_wallet",
      ok: negative.length === 0,
      detail:
        negative.length === 0 ? "no negative wallet or hold" : negative.map((r) => `${r.id}: ${r.balance}`).join("; "),
    },
    {
      name: "receivables",
      ok: true,
      detail:
        owing.length === 0
          ? "nobody owes the platform"
          : `${owing.length} owing: ${owing
              .slice(0, 20)
              .map((r) => `${r.id.slice("receivable:".length)} owes ${r.owed}`)
              .join("; ")}`,
    },
  ];
  return { ok: checks.every((c) => c.ok), checks };
}
