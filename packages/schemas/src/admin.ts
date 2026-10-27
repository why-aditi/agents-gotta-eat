// Admin dashboard: ledger, reconciliation and LLM usage. Read-only. Cents are JSON integers here and bigint
// inside the api. Never floats.
import { z } from "zod";

export const JournalKind = z.enum([
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
export type JournalKind = z.infer<typeof JournalKind>;

export const LedgerAccountType = z.enum(["asset", "liability", "revenue"]);
export type LedgerAccountType = z.infer<typeof LedgerAccountType>;

export const ADMIN_JOURNALS_DEFAULT_LIMIT = 100;
export const ADMIN_JOURNALS_MAX_LIMIT = 200;

// GET /v1/admin/journals. `cursor` is the opaque `nextCursor` of the previous page.
export const AdminJournalsQuery = z.object({
  cursor: z.string().min(1).max(400).optional(),
  limit: z.coerce.number().int().min(1).max(ADMIN_JOURNALS_MAX_LIMIT).optional(),
  kind: JournalKind.optional(),
});
export type AdminJournalsQuery = z.infer<typeof AdminJournalsQuery>;

export const AdminJournal = z.object({
  id: z.string(),
  kind: JournalKind,
  refType: z.string().nullable(),
  refId: z.string().nullable(),
  idempotencyKey: z.string(),
  // Sum of the journal's debits (equal to its credits).
  totalCents: z.int(),
  lineCount: z.int(),
  createdAt: z.iso.datetime(),
});
export type AdminJournal = z.infer<typeof AdminJournal>;

export const AdminJournalList = z.object({
  items: z.array(AdminJournal),
  nextCursor: z.string().nullable(),
});
export type AdminJournalList = z.infer<typeof AdminJournalList>;

export const AdminJournalLine = z.object({
  id: z.string(),
  accountId: z.string(),
  accountType: LedgerAccountType,
  ownerId: z.string().nullable(),
  debitCents: z.int(),
  creditCents: z.int(),
});
export type AdminJournalLine = z.infer<typeof AdminJournalLine>;

export const AdminJournalDetail = AdminJournal.omit({ lineCount: true }).extend({
  lines: z.array(AdminJournalLine),
});
export type AdminJournalDetail = z.infer<typeof AdminJournalDetail>;

export const AdminAccount = z.object({
  id: z.string(),
  type: LedgerAccountType,
  ownerId: z.string().nullable(),
  memo: z.boolean(),
  // From the entries: debits - credits for assets, credits - debits for liabilities and revenue.
  balanceCents: z.int(),
  // The wallets cache, for wallet accounts only. A mismatch with balanceCents is a reconciliation failure.
  cachedBalanceCents: z.int().nullable(),
  createdAt: z.iso.datetime(),
});
export type AdminAccount = z.infer<typeof AdminAccount>;

export const AdminAccountList = z.object({ accounts: z.array(AdminAccount) });
export type AdminAccountList = z.infer<typeof AdminAccountList>;

export const ReconcileCheck = z.object({
  name: z.string(),
  ok: z.boolean(),
  detail: z.string(),
});
export type ReconcileCheck = z.infer<typeof ReconcileCheck>;

export const ReconcileReport = z.object({
  ok: z.boolean(),
  checks: z.array(ReconcileCheck),
  checkedAt: z.iso.datetime(),
});
export type ReconcileReport = z.infer<typeof ReconcileReport>;

export const LlmRole = z.enum(["mandate_compile", "intent_check", "judge", "treasurer"]);
export type LlmRole = z.infer<typeof LlmRole>;

export const LlmOutcome = z.enum(["ok", "invalid_output", "error", "timeout", "over_budget"]);
export type LlmOutcome = z.infer<typeof LlmOutcome>;

// One gateway request. Prompts and model output are never stored or returned.
export const LlmCall = z.object({
  id: z.string(),
  role: LlmRole,
  model: z.string(),
  servedModel: z.string().nullable(),
  outcome: LlmOutcome,
  latencyMs: z.int(),
  promptTokens: z.int().nullable(),
  completionTokens: z.int().nullable(),
  createdAt: z.iso.datetime(),
});
export type LlmCall = z.infer<typeof LlmCall>;

export const LlmUsage = z.object({
  // The UTC day `used` and `byRole` cover, "YYYY-MM-DD".
  day: z.string(),
  budget: z.int(),
  // Requests sent today. Refused (over_budget) calls are in byRole but not here.
  used: z.int(),
  byRole: z.array(z.object({ role: LlmRole, outcome: LlmOutcome, count: z.int() })),
  // The last 100 calls, newest first, any day.
  recent: z.array(LlmCall),
});
export type LlmUsage = z.infer<typeof LlmUsage>;
