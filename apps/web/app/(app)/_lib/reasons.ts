// Plain-English wording for policy outcomes, shared by the spend timeline and the approvals queue.
// Pure data and functions (no React), so server and client components can both use it.
import {
  type ErrorCode,
  type GateName,
  PayoutStatus,
  PolicyReason,
  type SpendDecision,
  type SpendRequest,
  type SpendStatus,
  type Verdict,
} from "@gottaeat/schemas";

export const REASON_TEXT: Record<PolicyReason, string> = {
  no_mandate: "The agent has no confirmed mandate",
  mandate_expired: "The mandate has expired",
  insufficient_funds: "Not enough money in the wallet",
  over_per_tx: "Over the per-spend cap",
  over_daily: "Over the daily cap",
  category_not_allowed: "The mandate doesn't allow this kind of spend",
  unknown_payee: "The payee isn't a known agent",
  payee_inactive: "The payee agent isn't active",
  self_payee: "An agent can't pay itself",
  payee_not_allowed: "The payee isn't on the allowed list",
  payee_rating_too_low: "The payee's rating is below the minimum",
  scope_requires_bounty: "The mandate only allows spends for a bounty, and none was given",
  rate_limited: "Too many spend requests in a short time",
  bounty_not_open: "The bounty isn't open",
  own_bounty: "Agents can't enter their owner's own bounty",
  scope_requires_entry: "The agent hasn't entered that bounty",
  over_bounty_spend_rule: "Over the bounty's spend rule",
  account_frozen: "Your account owes money after a PayPal reversal; top up to repay it",
  above_ask_threshold: 'Above your "ask me above" amount',
  intent_ask: "The intent check wants you to take a look",
  intent_deny: "The intent check thinks this doesn't match the mandate",
};

// Unknown codes (a newer api) still render, as the raw code.
export function describeReason(code: string): string {
  const parsed = PolicyReason.safeParse(code);
  return parsed.success ? REASON_TEXT[parsed.data] : code;
}

export const GATE_LABEL: Record<GateName, string> = {
  hard_rules: "Hard rules",
  intent: "Intent check",
  owner: "Owner",
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  allow: "Allow",
  ask: "Ask the owner",
  deny: "Deny",
};

// Status words as the UI shows them: "pending approval", not "pending_approval".
export const STATUS_LABEL: Record<SpendStatus, string> = {
  pending_approval: "pending approval",
  allowed: "allowed",
  settled: "settled",
  denied: "denied",
  released: "released",
};

// The sentences one gate's decision explains itself with. Gate 1 stores reason codes; gate 2's free text and
// the owner gate's detail are summarised by `decisionNote`.
export function decisionReasons(decision: SpendDecision): string[] {
  if (decision.gate === "hard_rules") {
    const codes = decision.detail.reasons;
    return Array.isArray(codes) ? codes.filter((c): c is string => typeof c === "string").map(describeReason) : [];
  }
  if (decision.gate === "intent") {
    if (decision.verdict === "ask") return [REASON_TEXT.intent_ask];
    if (decision.verdict === "deny") return [REASON_TEXT.intent_deny];
    return [];
  }
  if (decision.detail.expired === true) return ["You didn't answer within the approval window"];
  if (decision.verdict === "allow") return ["You approved it"];
  if (decision.verdict === "deny") return ["You denied it"];
  return [];
}

// Gate 2's own explanation. Model output shaped by untrusted agent text: callers render it as plain text only.
export function decisionNote(decision: SpendDecision): string | null {
  if (decision.gate !== "intent") return null;
  const note = decision.detail.reason;
  return typeof note === "string" && note.trim() ? note : null;
}

// Every reason across all gates, in gate order, without repeats. Used for "why does this need me?".
export function spendRequestReasons(spend: Pick<SpendRequest, "decisions">): string[] {
  return [...new Set(spend.decisions.flatMap(decisionReasons))];
}

// One-line outcome for the timeline's "Decision" column.
export function outcomeSummary(spend: Pick<SpendRequest, "status" | "decisions">): string {
  const byGate = (gate: GateName) => spend.decisions.filter((d) => d.gate === gate).at(-1);
  const owner = byGate("owner");
  switch (spend.status) {
    case "pending_approval":
      return "Waiting for you";
    case "allowed":
      return owner?.verdict === "allow" ? "Approved by you, paying out" : "Allowed, paying out";
    case "settled":
      return owner?.verdict === "allow" ? "Approved by you" : "Allowed automatically";
    case "denied":
      if (owner?.verdict === "deny") return "Denied by you";
      if (byGate("hard_rules")?.verdict === "deny") return "Blocked by hard rules";
      if (byGate("intent")?.verdict === "deny") return "Blocked by the intent check";
      return "Denied";
    case "released":
      return owner?.detail.expired === true ? "Approval window expired" : "Released";
  }
}

// PayPal money in and out. Friendly wording for the api error codes these screens can hit; anything else keeps
// the api's own message.
const PAYMENT_ERROR_TEXT: Partial<Record<ErrorCode, string>> = {
  below_minimum: "That amount is below the minimum.",
  insufficient_funds: "Your wallet doesn't have enough available balance for that.",
  no_paypal_email: "Add a PayPal email first, so we know where to send the money.",
  account_frozen: "PayPal took back money you paid in. Top up to repay what you owe first.",
  paypal_error: "PayPal had a problem with that. Nothing was charged or moved; try again in a moment.",
  paypal_not_configured: "PayPal isn't set up on this server yet.",
  escrow_not_authorized: "PayPal hasn't approved this payment yet. Wait a moment and try again.",
};

export function describePaymentError(code: string, message: string): string {
  return PAYMENT_ERROR_TEXT[code as ErrorCode] ?? message;
}

// How a withdrawal reads to its owner. Failed, returned and canceled all mean the money is back in the wallet.
export const PAYOUT_STATUS_LABEL: Record<PayoutStatus, string> = {
  pending: "pending",
  unclaimed: "waiting for the recipient to claim",
  succeeded: "succeeded",
  failed: "returned to your wallet",
  returned: "returned to your wallet",
  canceled: "returned to your wallet",
};

// Disputes (disp-01): wording for the codes opening or resolving a dispute can hit; anything else falls back to the
// payment wording, then the api's own message.
const DISPUTE_ERROR_TEXT: Partial<Record<ErrorCode, string>> = {
  dispute_window_closed: "The 12-hour dispute window has closed, so the result is final.",
  not_disputable: "Only a result the platform judged automatically can be disputed, once the bounty has settled.",
  dispute_exists: "This result has already been disputed.",
  dispute_not_open: "This dispute has already been resolved.",
  paypal_error: "PayPal couldn't make the refund. The dispute is still open; try again in a moment.",
};

export function describeDisputeError(code: string, message: string): string {
  return DISPUTE_ERROR_TEXT[code as ErrorCode] ?? describePaymentError(code, message);
}
