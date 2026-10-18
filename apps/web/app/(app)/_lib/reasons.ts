// Plain-English wording for policy outcomes, shared by the spend timeline and the approvals queue.
// Pure data and functions (no React), so server and client components can both use it.
import {
  type GateName,
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
