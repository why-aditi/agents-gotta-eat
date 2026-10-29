// Pocket Money policy engine: mandates, spend requests, decisions and approvals.
// Cents are JSON integers here and bigint inside the api. Never floats.
import { z } from "zod";

const Cents = z.int().min(0);
const PositiveCents = z.int().min(1);

export const SpendCategory = z.enum(["subcontract", "stake", "tool"]);
export type SpendCategory = z.infer<typeof SpendCategory>;

// Categories an agent may request directly. Stakes are created by the Arena.
export const RequestableCategory = z.enum(["subcontract", "tool"]);
export type RequestableCategory = z.infer<typeof RequestableCategory>;

export const SpendStatus = z.enum(["pending_approval", "allowed", "settled", "denied", "released"]);
export type SpendStatus = z.infer<typeof SpendStatus>;

export const Verdict = z.enum(["allow", "ask", "deny"]);
export type Verdict = z.infer<typeof Verdict>;

export const GateName = z.enum(["hard_rules", "intent", "owner"]);
export type GateName = z.infer<typeof GateName>;

// Gate 1 deny reasons.
export const DenyReason = z.enum([
  "no_mandate",
  "mandate_expired",
  "insufficient_funds",
  "over_per_tx",
  "over_daily",
  "category_not_allowed",
  "unknown_payee",
  "payee_inactive",
  "self_payee",
  "payee_not_allowed",
  "payee_rating_too_low",
  "scope_requires_bounty",
  "rate_limited",
  // Arena: a bounty must be open, an owner can't stake on their own bounty, a spend naming a bounty
  // needs an entry under current_bounty_only and must stay within the bounty's spend rule.
  "bounty_not_open",
  "own_bounty",
  "scope_requires_entry",
  "over_bounty_spend_rule",
  // The owner owes the platform money after a PayPal reversal (pm-04c).
  "account_frozen",
]);
export type DenyReason = z.infer<typeof DenyReason>;

// Everything that can appear in a response's `reasons`: gate 1 deny reasons, gate 1's ask threshold,
// and gate 2's outcome (its free text stays in the decision detail).
export const PolicyReason = z.enum([...DenyReason.options, "above_ask_threshold", "intent_ask", "intent_deny"]);
export type PolicyReason = z.infer<typeof PolicyReason>;

export const MandateRules = z.object({
  perTxMaxCents: Cents,
  dailyMaxCents: Cents,
  askAboveCents: Cents.optional(),
  allowedCategories: z.array(SpendCategory).min(1),
  // Agent ids, or null for anyone.
  payeeAllowlist: z.array(z.string().min(1)).nullable(),
  // Tenths of a star: 4.0 is 40.
  minPayeeRatingTenths: z.int().min(0).max(50).optional(),
  scope: z.enum(["any", "current_bounty_only"]),
  expiresAt: z.iso.datetime().nullable().optional(),
});
export type MandateRules = z.infer<typeof MandateRules>;

export const PutMandateRequest = z.object({
  sourceText: z.string().trim().min(1).max(4000),
  rules: MandateRules,
});
export type PutMandateRequest = z.infer<typeof PutMandateRequest>;

// POST /v1/agents/:id/mandate/compile: the owner's words in, proposed rules out. Nothing is saved; the owner
// still reviews, PUTs and confirms.
export const CompileMandateRequest = z.object({ sourceText: PutMandateRequest.shape.sourceText });
export type CompileMandateRequest = z.infer<typeof CompileMandateRequest>;

export const CompileMandateResponse = z.object({
  rules: MandateRules,
  // Plain-English notes from the compiler: assumptions, and anything in the text it could not express.
  notes: z.array(z.string().max(500)).max(20),
});
export type CompileMandateResponse = z.infer<typeof CompileMandateResponse>;

export const Mandate = z.object({
  id: z.string(),
  agentId: z.string(),
  version: z.int().min(1),
  sourceText: z.string(),
  rules: MandateRules,
  createdAt: z.iso.datetime(),
  confirmedAt: z.iso.datetime().nullable(),
});
export type Mandate = z.infer<typeof Mandate>;

export const ConfirmMandateRequest = z.object({ version: z.int().min(1) });
export type ConfirmMandateRequest = z.infer<typeof ConfirmMandateRequest>;

// GET /v1/agents/:id/mandates, newest version first.
export const MandateList = z.object({ mandates: z.array(Mandate) });
export type MandateList = z.infer<typeof MandateList>;

export const CreateSpendRequest = z.object({
  payeeAgentId: z.string().min(1).max(64),
  amountCents: PositiveCents,
  category: RequestableCategory,
  // Untrusted agent text. Never put it in a prompt without delimiters and a warning.
  reason: z.string().min(1).max(500),
  bountyId: z.string().min(1).max(64).optional(),
});
export type CreateSpendRequest = z.infer<typeof CreateSpendRequest>;

export const SpendDecision = z.object({
  gate: GateName,
  verdict: Verdict,
  confidence: z.int().min(0).max(100).nullable(),
  detail: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
});
export type SpendDecision = z.infer<typeof SpendDecision>;

export const SpendRequest = z.object({
  id: z.string(),
  agentId: z.string(),
  // The spending agent's name. Agent-supplied text.
  agentName: z.string(),
  payeeAgentId: z.string().nullable(),
  // Null when there is no payee agent (a stake).
  payeeAgentName: z.string().nullable(),
  amountCents: PositiveCents,
  feeCents: Cents,
  category: SpendCategory,
  reason: z.string(),
  bountyId: z.string().nullable(),
  status: SpendStatus,
  expiresAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  decidedAt: z.iso.datetime().nullable(),
  decisions: z.array(SpendDecision),
});
export type SpendRequest = z.infer<typeof SpendRequest>;

// GET /v1/approvals and GET /v1/agents/:id/spend-requests.
export const SpendRequestList = z.object({ spendRequests: z.array(SpendRequest) });
export type SpendRequestList = z.infer<typeof SpendRequestList>;

export const SpendOutcome = z.enum(["allow", "pending_approval", "deny"]);
export type SpendOutcome = z.infer<typeof SpendOutcome>;

export const CreateSpendResponse = z.object({
  id: z.string(),
  status: SpendStatus,
  decision: SpendOutcome,
  reasons: z.array(PolicyReason),
});
export type CreateSpendResponse = z.infer<typeof CreateSpendResponse>;

export const ApprovalRequest = z.object({ decision: z.enum(["approve", "deny"]) });
export type ApprovalRequest = z.infer<typeof ApprovalRequest>;

export const Wallet = z.object({
  ownerId: z.string(),
  balanceCents: Cents,
  heldCents: Cents,
  // What the owner owes the platform after a PayPal refund or reversal. Above zero the account is frozen: no
  // spends, withdrawals or new bounties until a top-up repays it.
  owedCents: Cents,
  agent: z
    .object({
      agentId: z.string(),
      todaySpentCents: Cents,
      limits: MandateRules.nullable(),
    })
    .optional(),
});
export type Wallet = z.infer<typeof Wallet>;

// GET /v1/wallet/activity: one movement of the owner's available balance per ledger journal, newest first.
export const WalletActivityKind = z.enum([
  "topup",
  "spend",
  "earning",
  "hold",
  "release",
  "withdrawal",
  "refund",
  "fee",
  "credit",
  "other",
]);
export type WalletActivityKind = z.infer<typeof WalletActivityKind>;

export const WALLET_ACTIVITY_DEFAULT = 50;
export const WALLET_ACTIVITY_MAX = 100;

export const WalletActivityQuery = z.object({
  limit: z.coerce.number().int().min(1).max(WALLET_ACTIVITY_MAX).default(WALLET_ACTIVITY_DEFAULT),
  agentId: z.string().min(1).max(64).optional().describe("Only this agent's movements (one of your agents)"),
});
export type WalletActivityQuery = z.infer<typeof WalletActivityQuery>;

export const WalletActivityItem = z.object({
  id: z.string(),
  kind: WalletActivityKind,
  // Signed: positive is money into the available balance, negative is money out of it.
  amountCents: z.int(),
  // Plain English, no ids.
  label: z.string(),
  agentId: z.string().nullable(),
  // Agent-supplied text.
  agentName: z.string().nullable(),
  bountyId: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type WalletActivityItem = z.infer<typeof WalletActivityItem>;

export const WalletActivity = z.object({ items: z.array(WalletActivityItem) });
export type WalletActivity = z.infer<typeof WalletActivity>;

export const DevCreditRequest = z.object({ amountCents: PositiveCents });
export type DevCreditRequest = z.infer<typeof DevCreditRequest>;
