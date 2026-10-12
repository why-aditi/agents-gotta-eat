// Hard rule: money columns are bigint integer cents (mode "bigint"). Never floats.
import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: text().primaryKey(),
  email: text().notNull().unique(),
  name: text(),
  paypalEmail: text("paypal_email"),
  roles: text()
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  createdAt: createdAt(),
});

export const agentKind = pgEnum("agent_kind", ["house", "external"]);

export const agents = pgTable(
  "agents",
  {
    id: text().primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    name: text().notNull(),
    kind: agentKind().notNull(),
    apiKeyHash: text("api_key_hash"),
    // Tenths of a star: 4.0 is 40.
    rating: integer().notNull().default(0),
    status: text().notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [check("agents_rating_range", sql`${t.rating} between 0 and 50`)],
);

export const wallets = pgTable(
  "wallets",
  {
    ownerId: text("owner_id")
      .primaryKey()
      .references(() => users.id),
    balanceCents: bigint("balance_cents", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    heldCents: bigint("held_cents", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("wallets_balance_nonneg", sql`${t.balanceCents} >= 0`),
    check("wallets_held_nonneg", sql`${t.heldCents} >= 0`),
  ],
);

export const ledgerAccountType = pgEnum("ledger_account_type", ["asset", "liability", "revenue"]);

export const ledgerAccounts = pgTable("ledger_accounts", {
  id: text().primaryKey(),
  type: ledgerAccountType().notNull(),
  ownerId: text("owner_id").references(() => users.id),
  memo: boolean().notNull().default(false),
  createdAt: createdAt(),
});

export const journalKind = pgEnum("journal_kind", [
  "topup",
  "stake",
  "hire",
  "settle",
  "payout",
  "fee",
  "refund",
  "release",
]);

export const journals = pgTable("journals", {
  id: text().primaryKey(),
  kind: journalKind().notNull(),
  refType: text("ref_type"),
  refId: text("ref_id"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  createdAt: createdAt(),
});

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: text().primaryKey(),
    journalId: text("journal_id")
      .notNull()
      .references(() => journals.id),
    accountId: text("account_id")
      .notNull()
      .references(() => ledgerAccounts.id),
    debitCents: bigint("debit_cents", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    creditCents: bigint("credit_cents", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "ledger_entries_one_sided",
      sql`${t.debitCents} >= 0 and ${t.creditCents} >= 0 and (${t.debitCents} > 0) <> (${t.creditCents} > 0)`,
    ),
    index("ledger_entries_account_id_idx").on(t.accountId),
    index("ledger_entries_journal_id_idx").on(t.journalId),
  ],
);
