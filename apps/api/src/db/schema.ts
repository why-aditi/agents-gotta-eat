// Hard rule: money columns are bigint integer cents (mode "bigint"). Never floats.
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

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
    // SHA-256 hex of the key. The plaintext is shown once and never stored.
    apiKeyHash: text("api_key_hash"),
    apiKeyPrefix: text("api_key_prefix"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    // Tenths of a star: 4.0 is 40.
    rating: integer().notNull().default(0),
    status: text().notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [
    check("agents_rating_range", sql`${t.rating} between 0 and 50`),
    uniqueIndex("agents_api_key_hash_idx").on(t.apiKeyHash),
  ],
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

// One row per (caller, Idempotency-Key). Rows older than 24 hours count as expired.
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    principal: text().notNull(),
    key: text().notNull(),
    method: text().notNull(),
    path: text().notNull(),
    requestHash: text("request_hash").notNull(),
    status: text().notNull(),
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body"),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.principal, t.key] }),
    check("idempotency_keys_status", sql`${t.status} in ('in_progress', 'done')`),
  ],
);

export const mandates = pgTable(
  "mandates",
  {
    id: text().primaryKey(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id),
    version: integer().notNull(),
    sourceText: text("source_text").notNull(),
    rules: jsonb().notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("mandates_agent_version_idx").on(t.agentId, t.version)],
);

export const spendCategory = pgEnum("spend_category", ["subcontract", "stake", "tool"]);
export const spendStatus = pgEnum("spend_status", ["pending_approval", "allowed", "settled", "denied", "released"]);
export const gateName = pgEnum("gate_name", ["hard_rules", "intent", "owner"]);
export const verdict = pgEnum("verdict", ["allow", "ask", "deny"]);

export const spendRequests = pgTable(
  "spend_requests",
  {
    id: text().primaryKey(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    bountyId: text("bounty_id"),
    payeeType: text("payee_type").notNull().default("agent"),
    // Null when the request named an agent that doesn't exist (denied as unknown_payee).
    payeeId: text("payee_id"),
    payeeOwnerId: text("payee_owner_id").references(() => users.id),
    amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
    feeCents: bigint("fee_cents", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    category: spendCategory().notNull(),
    reason: text().notNull(),
    status: spendStatus().notNull(),
    mandateId: text("mandate_id").references(() => mandates.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check("spend_requests_amount_pos", sql`${t.amountCents} > 0 and ${t.feeCents} >= 0`),
    index("spend_requests_agent_created_idx").on(t.agentId, t.createdAt),
    index("spend_requests_status_expires_idx").on(t.status, t.expiresAt),
    index("spend_requests_owner_status_idx").on(t.ownerId, t.status),
  ],
);

export const spendDecisions = pgTable(
  "spend_decisions",
  {
    id: text().primaryKey(),
    spendRequestId: text("spend_request_id")
      .notNull()
      .references(() => spendRequests.id),
    gate: gateName().notNull(),
    verdict: verdict().notNull(),
    confidence: integer(),
    detail: jsonb().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("spend_decisions_confidence_range", sql`${t.confidence} is null or ${t.confidence} between 0 and 100`),
    index("spend_decisions_request_idx").on(t.spendRequestId),
  ],
);
