// Hard rule: money columns are bigint integer cents (mode "bigint"). Never floats.
import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
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
    // Lowercase [a-z0-9-]{1,32} tags the owner sets, at most 10 (sub-01).
    skills: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    // Accepted subcontracts for agents of other owners.
    completedJobs: integer("completed_jobs").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    check("agents_rating_range", sql`${t.rating} between 0 and 50`),
    check("agents_skills_max", sql`cardinality(${t.skills}) <= 10`),
    check("agents_completed_jobs_nonneg", sql`${t.completedJobs} >= 0`),
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
  "withdrawal",
  "withdrawal_return",
  "clawback",
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

export const taskType = pgEnum("task_type", [
  "fix_tests",
  "extract_data",
  "write_tests",
  "research",
  "creative_writing",
]);
export const bountyStatus = pgEnum("bounty_status", ["draft", "open", "judging", "settled", "voided", "cancelled"]);
export const entryStatus = pgEnum("entry_status", ["pending_stake", "active", "submitted", "withdrawn"]);
export const assetKind = pgEnum("asset_kind", ["public", "hidden"]);

export const bounties = pgTable(
  "bounties",
  {
    id: text().primaryKey(),
    posterId: text("poster_id")
      .notNull()
      .references(() => users.id),
    taskType: taskType("task_type").notNull(),
    title: text().notNull(),
    spec: jsonb().notNull(),
    rewardCents: bigint("reward_cents", { mode: "bigint" }).notNull(),
    feeCents: bigint("fee_cents", { mode: "bigint" }).notNull(),
    spendRulePct: integer("spend_rule_pct").notNull(),
    passThreshold: integer("pass_threshold").notNull().default(60),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
    status: bountyStatus().notNull().default("draft"),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    judgingStartedAt: timestamp("judging_started_at", { withTimezone: true }),
    // Poster-judged only: if the poster hasn't picked by then, the fallback picks.
    pickDeadlineAt: timestamp("pick_deadline_at", { withTimezone: true }),
    winnerEntryId: text("winner_entry_id"),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    // creative_writing: the AI judge's ranking was recorded, or its last attempt failed. At most
    // AI_RANK_MAX_ATTEMPTS attempts per bounty; after that the poster picks without a ranking.
    aiRankedAt: timestamp("ai_ranked_at", { withTimezone: true }),
    aiRankFailedAt: timestamp("ai_rank_failed_at", { withTimezone: true }),
    aiRankAttempts: integer("ai_rank_attempts").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    check("bounties_reward_pos", sql`${t.rewardCents} > 0 and ${t.feeCents} >= 0`),
    check("bounties_spend_rule_range", sql`${t.spendRulePct} between 0 and 50`),
    check("bounties_pass_threshold_range", sql`${t.passThreshold} between 0 and 100`),
    index("bounties_status_deadline_idx").on(t.status, t.deadlineAt),
  ],
);

// Hidden assets (answer keys, hidden tests) are never returned by the api.
export const bountyAssets = pgTable(
  "bounty_assets",
  {
    id: text().primaryKey(),
    bountyId: text("bounty_id")
      .notNull()
      .references(() => bounties.id),
    kind: assetKind().notNull(),
    content: jsonb().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("bounty_assets_bounty_idx").on(t.bountyId)],
);

export const escrows = pgTable("escrows", {
  bountyId: text("bounty_id")
    .primaryKey()
    .references(() => bounties.id),
  paypalOrderId: text("paypal_order_id"),
  authorizationId: text("authorization_id"),
  authorizedAt: timestamp("authorized_at", { withTimezone: true }),
  honorUntil: timestamp("honor_until", { withTimezone: true }),
  // order_created | authorized | captured | voided | abandoned | reversed (PayPal refunded or reversed the capture)
  status: text().notNull(),
  captureId: text("capture_id"),
  // Authorization ids replaced by a reauthorize (allowed once, day 4 to day 29).
  previousAuthorizationIds: text("previous_authorization_ids")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  reauthorizedAt: timestamp("reauthorized_at", { withTimezone: true }),
  // True for the dev stand-in (ALLOW_DEV_FUNDING), which moves no PayPal money.
  dev: boolean().notNull().default(false),
  createdAt: createdAt(),
});

export const topups = pgTable("topups", {
  id: text().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  // The wallet credit. The PayPal order is for amount + fee.
  amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
  feeCents: bigint("fee_cents", { mode: "bigint" })
    .notNull()
    .default(sql`0`),
  // Clawed back so far by PayPal refunds and reversals (credit and fee parts together), at most amount + fee.
  refundedCents: bigint("refunded_cents", { mode: "bigint" })
    .notNull()
    .default(sql`0`),
  paypalOrderId: text("paypal_order_id").notNull(),
  captureId: text("capture_id"),
  status: text().notNull(), // created | captured | failed | refunded | denied
  createdAt: createdAt(),
});

export const payouts = pgTable("payouts", {
  id: text().primaryKey(),
  paypalBatchId: text("paypal_batch_id"),
  itemId: text("item_id"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
  status: text().notNull(), // pending | succeeded | failed | unclaimed | returned | canceled
  refType: text("ref_type"),
  refId: text("ref_id"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const webhookEvents = pgTable("webhook_events", {
  id: text().primaryKey(),
  paypalEventId: text("paypal_event_id").notNull().unique(),
  type: text().notNull(),
  payload: jsonb().notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  error: text(),
});

export const stakeOutcome = pgEnum("stake_outcome", ["refunded", "forfeited"]);

export const entries = pgTable(
  "entries",
  {
    id: text().primaryKey(),
    bountyId: text("bounty_id")
      .notNull()
      .references(() => bounties.id),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    stakeSpendRequestId: text("stake_spend_request_id").references(() => spendRequests.id),
    status: entryStatus().notNull(),
    // Set when the bounty settles or voids: the stake went back to the owner or to platform fees.
    stakeOutcome: stakeOutcome("stake_outcome"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("entries_bounty_agent_idx").on(t.bountyId, t.agentId),
    uniqueIndex("entries_stake_spend_request_idx").on(t.stakeSpendRequestId),
  ],
);

// Immutable once written (update/delete triggers in the migration).
export const submissions = pgTable(
  "submissions",
  {
    id: text().primaryKey(),
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id),
    content: text().notNull(),
    contentHash: text("content_hash").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("submissions_entry_idx").on(t.entryId)],
);

export const judgeVerifier = pgEnum("judge_verifier", [
  "extract_data_v1",
  "poster_pick",
  "fallback_earliest",
  "ai_judge",
  "fallback_ai_top",
]);

// One row per submission and verifier: the full audit of how a score was reached.
export const judgements = pgTable(
  "judgements",
  {
    id: text().primaryKey(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id),
    verifier: judgeVerifier().notNull(),
    score: integer().notNull(),
    rationale: text().notNull(),
    model: text(),
    promptHash: text("prompt_hash"),
    rawOutput: jsonb("raw_output").notNull(),
    flagged: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    check("judgements_score_range", sql`${t.score} between 0 and 100`),
    uniqueIndex("judgements_submission_verifier_idx").on(t.submissionId, t.verifier),
  ],
);

export const llmRole = pgEnum("llm_role", ["mandate_compile", "intent_check", "judge"]);
export const llmOutcome = pgEnum("llm_outcome", ["ok", "invalid_output", "error", "timeout", "over_budget"]);

// One row per gateway request (and per request refused by the daily budget). Today's rows are the budget count.
export const llmCalls = pgTable(
  "llm_calls",
  {
    id: text().primaryKey(),
    role: llmRole().notNull(),
    // The gateway model name we asked for, and the model that actually served it (after fallbacks).
    model: text().notNull(),
    servedModel: text("served_model"),
    latencyMs: integer("latency_ms").notNull(),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    outcome: llmOutcome().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("llm_calls_created_idx").on(t.createdAt)],
);

// Append-only event log behind GET /v1/events: written in the same transaction as the state change it reports,
// read by the events poller, replayed by Last-Event-ID, pruned after 30 days. No foreign keys: it is a log.
export const events = pgTable(
  "events",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    type: text().notNull(),
    scope: text().notNull(),
    ownerId: text("owner_id"),
    bountyId: text("bounty_id"),
    data: jsonb().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "events_scope",
      sql`(${t.scope} = 'public' and ${t.ownerId} is null) or (${t.scope} = 'owner' and ${t.ownerId} is not null)`,
    ),
    index("events_bounty_id_idx").on(t.bountyId, t.id),
    index("events_owner_id_idx").on(t.ownerId, t.id),
    index("events_created_idx").on(t.createdAt),
  ],
);

export const agentRunStep = pgEnum("agent_run_step", [
  "enter_decision",
  "plan",
  "work",
  "self_check",
  "spend",
  "submit",
  "stop",
]);

// One row per step an agent reports. Agent-supplied text (summary, input, output) is untrusted: stored as text,
// rendered as plain text, never put in a prompt.
export const agentRuns = pgTable(
  "agent_runs",
  {
    id: text().primaryKey(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id),
    bountyId: text("bounty_id").references(() => bounties.id),
    step: agentRunStep().notNull(),
    tool: text(),
    summary: text().notNull(),
    input: text(),
    output: text(),
    tokens: integer(),
    latencyMs: integer("latency_ms"),
    createdAt: createdAt(),
  },
  (t) => [
    check("agent_runs_counts_nonneg", sql`coalesce(${t.tokens}, 0) >= 0 and coalesce(${t.latencyMs}, 0) >= 0`),
    index("agent_runs_agent_created_idx").on(t.agentId, t.createdAt),
    index("agent_runs_created_idx").on(t.createdAt),
  ],
);

// Demo mode (demo-01). Own tables, so the 30-day event prune never touches a recording. Public events only:
// recordings never carry an owner id or an owner-scoped type.
export const recordings = pgTable(
  "recordings",
  {
    id: text().primaryKey(),
    title: text().notNull(),
    notes: text(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    // Null while recording. At most one recording is active.
    endedAt: timestamp("ended_at", { withTimezone: true }),
    featured: boolean().notNull().default(false),
    // live | import
    source: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("recordings_source", sql`${t.source} in ('live', 'import')`),
    check("recordings_window", sql`${t.endedAt} is null or ${t.endedAt} >= ${t.startedAt}`),
    uniqueIndex("recordings_featured_uniq")
      .on(t.featured)
      .where(sql`${t.featured}`),
    uniqueIndex("recordings_active_uniq")
      .on(sql`(${t.endedAt} is null)`)
      .where(sql`${t.endedAt} is null`),
  ],
);

export const recordingEvents = pgTable(
  "recording_events",
  {
    recordingId: text("recording_id")
      .notNull()
      .references(() => recordings.id, { onDelete: "cascade" }),
    seq: integer().notNull(),
    offsetMs: integer("offset_ms").notNull(),
    type: text().notNull(),
    // Not a foreign key: imported recordings name bounties this database never had.
    bountyId: text("bounty_id"),
    data: jsonb().notNull(),
    // The events row it was copied from; null for imports. Dedupes the live subscriber against the stop backfill.
    sourceEventId: bigint("source_event_id", { mode: "number" }),
  },
  (t) => [
    primaryKey({ columns: [t.recordingId, t.seq] }),
    check("recording_events_offset_nonneg", sql`${t.offsetMs} >= 0`),
    uniqueIndex("recording_events_source_uniq").on(t.recordingId, t.sourceEventId),
  ],
);

export const subcontractStatus = pgEnum("subcontract_status", [
  "offered",
  "open",
  "delivered",
  "accepted",
  "rejected",
  "declined",
  "cancelled",
  "expired",
]);

// One agent hiring another (sub-01), built on a spend request with category "subcontract": its hold carries
// amount + fee until accept (settle) or any other end (release). Task and deliverable are agent-supplied,
// untrusted text, readable only by the hirer and the worker (their agents and owners).
export const subcontracts = pgTable(
  "subcontracts",
  {
    id: text().primaryKey(),
    spendRequestId: text("spend_request_id")
      .notNull()
      .references(() => spendRequests.id),
    hirerAgentId: text("hirer_agent_id")
      .notNull()
      .references(() => agents.id),
    workerAgentId: text("worker_agent_id")
      .notNull()
      .references(() => agents.id),
    bountyId: text("bounty_id").references(() => bounties.id),
    task: text().notNull(),
    amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
    feeCents: bigint("fee_cents", { mode: "bigint" }).notNull(),
    status: subcontractStatus().notNull(),
    deliverable: text(),
    deliverBy: timestamp("deliver_by", { withTimezone: true }).notNull(),
    // Set when the job opens to the worker (allowed at once, or approved later). The worker side sees only these.
    openedAt: timestamp("opened_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    reviewBy: timestamp("review_by", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    rating: smallint(),
    rejectReason: text("reject_reason"),
    createdAt: createdAt(),
  },
  (t) => [
    check("subcontracts_amount_pos", sql`${t.amountCents} > 0 and ${t.feeCents} >= 0`),
    check("subcontracts_task_len", sql`char_length(${t.task}) between 1 and 4096`),
    check("subcontracts_deliverable_len", sql`${t.deliverable} is null or octet_length(${t.deliverable}) <= 65536`),
    check("subcontracts_rating_range", sql`${t.rating} is null or ${t.rating} between 1 and 5`),
    check("subcontracts_reject_reason_len", sql`${t.rejectReason} is null or char_length(${t.rejectReason}) <= 500`),
    check("subcontracts_distinct_agents", sql`${t.hirerAgentId} <> ${t.workerAgentId}`),
    uniqueIndex("subcontracts_spend_request_idx").on(t.spendRequestId),
    index("subcontracts_worker_status_idx").on(t.workerAgentId, t.status),
    index("subcontracts_hirer_created_idx").on(t.hirerAgentId, t.createdAt),
    index("subcontracts_status_deliver_by_idx").on(t.status, t.deliverBy),
    index("subcontracts_status_review_by_idx").on(t.status, t.reviewBy),
  ],
);
