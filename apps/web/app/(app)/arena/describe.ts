// One line of plain text per live event. Agent names, bounty titles and run summaries are untrusted: they only
// ever reach the page as React text, never as HTML. Shared by the live arena and the /demo replay.
import type { AgentRunStep, PolicyReason, SpendCategory } from "@gottaeat/schemas";
import type { ArenaEvent } from "@gottaeat/schemas";
import { formatCents } from "@/lib/money";
import { describeReason } from "../_lib/reasons";

const TITLE_MAX = 40;

export function shortTitle(title: string): string {
  const t = title.trim();
  return t.length > TITLE_MAX ? `${t.slice(0, TITLE_MAX - 1).trimEnd()}…` : t;
}

const q = (title: string) => `“${shortTitle(title)}”`;

const STEP_LABEL: Record<AgentRunStep, string> = {
  enter_decision: "enter decision",
  plan: "plan",
  work: "work",
  self_check: "self-check",
  spend: "spend",
  submit: "submit",
  stop: "stopped",
};

// The first reason is enough for a feed line; the approvals page has them all.
function reasons(list: PolicyReason[]): string {
  return list[0] ? ` (${describeReason(list[0])})` : "";
}

const spendWhat = (amountCents: number, category: SpendCategory) =>
  `${formatCents(amountCents)} ${category === "stake" ? "stake" : `${category} spend`}`;

// " (PayPal order X, authorization Y)" for the ids that are present, else "".
function paypalIds(ids: [label: string, id: string | undefined][]): string {
  const present = ids.filter(([, id]) => id).map(([label, id]) => `${label} ${id}`);
  return present.length ? ` (PayPal ${present.join(", ")})` : "";
}

// `viewerId` turns owner events about the viewer's own agents into "Your agent …". Takes any ArenaEvent: ArenaEvent
// is a superset of it until the demo-01 schemas merge.
export function describeEvent(e: ArenaEvent, viewerId: string | null): string {
  switch (e.type) {
    case "bounty.opened":
      return `New bounty ${q(e.data.title)}: ${formatCents(e.data.rewardCents)} reward${paypalIds([
        ["order", e.data.paypalOrderId],
        ["authorization", e.data.authorizationId],
      ])}`;
    case "bounty.cancelled":
      return `${q(e.data.title)} was cancelled`;
    case "bounty.judging":
      return `${q(e.data.title)} closed; judging started`;
    case "bounty.settled":
      return `${e.data.winnerAgentName} won ${q(e.data.title)} and ${formatCents(e.data.rewardCents)}${paypalIds([
        ["capture", e.data.captureId],
      ])}`;
    case "bounty.voided":
      return `${q(e.data.title)} was voided: no entry passed`;
    case "entry.created":
      return `${e.data.agentName} entered ${q(e.data.title)}`;
    case "submission.received":
      return `${e.data.agentName} submitted to ${q(e.data.title)}`;
    case "judgement.recorded":
      return `${e.data.agentName} scored ${e.data.score} on ${q(e.data.title)}`;
    case "agent.run_step":
      return `${e.data.agentName}: ${STEP_LABEL[e.data.step]} — ${e.data.summary}`;
    case "spend.decided": {
      const who = e.ownerId === viewerId ? `Your agent ${e.data.agentName}'s` : `${e.data.agentName}'s`;
      const what = spendWhat(e.data.amountCents, e.data.category);
      if (e.data.decision === "pending_approval")
        return `${who} ${what} is waiting for approval${reasons(e.data.reasons)}`;
      if (e.data.decision === "allow") return `${who} ${what} was allowed`;
      return `${who} ${what} was denied${reasons(e.data.reasons)}`;
    }
    case "approval.decided": {
      const mine = e.ownerId === viewerId;
      const what = `${e.data.agentName}'s ${formatCents(e.data.amountCents)} ${e.data.category === "stake" ? "stake" : "spend"}`;
      if (e.data.decision === "expired") return `${mine ? "Your agent " : ""}${what} expired without a decision`;
      return `${mine ? "You" : "The owner"} ${e.data.decision} ${what}`;
    }
    case "wallet.clawback": {
      const what = e.data.source === "topup" ? "your top-up" : `your payment for ${q(e.data.title ?? "a bounty")}`;
      const owed = e.data.owedCents > 0 ? `you owe ${formatCents(e.data.owedCents)}` : "your wallet covered it";
      return `PayPal reversed ${formatCents(e.data.amountCents)} of ${what}; ${owed}`;
    }
    case "demo.spend_flagged":
      return `${e.data.agentName}'s ${spendWhat(e.data.amountCents, e.data.category)} was flagged by the intent check and sent to its owner`;
    // Subcontracts: names and amounts only, never the task or the deliverable.
    case "subcontract.hired":
      return `${e.data.hirerAgentName} hired ${e.data.workerAgentName} for ${formatCents(e.data.amountCents)}`;
    case "subcontract.delivered":
      return `${e.data.workerAgentName} delivered a job for ${e.data.hirerAgentName}`;
    case "subcontract.accepted":
      return `${e.data.hirerAgentName} accepted ${e.data.workerAgentName}'s work: ${formatCents(e.data.amountCents)} paid, rated ${e.data.rating}/5`;
    // Disputes (owner-scoped): never the reason.
    case "dispute.opened":
      return `The result of ${q(e.data.title)} was disputed; ${formatCents(e.data.amountCents)} is held for review`;
    case "dispute.resolved":
      return e.data.outcome === "upheld"
        ? `The dispute on ${q(e.data.title)} was rejected; the result stands`
        : `The result of ${q(e.data.title)} was overturned; ${formatCents(e.data.amountCents)} refunded to the poster`;
  }
}

// ui-05: the feeding frenzy. Who the line is about (for their creature head), an emoji for what happened, and for
// the big moments a playful headline that sits above the plain line from describeEvent (which never changes).
export interface EventFace {
  agent: { id: string; name: string } | null;
  emoji: string;
  headline: string | null;
}

// An allowed spend this big gets a headline of its own.
export const BIG_BITE_CENTS = 2000;

export function eventFace(e: ArenaEvent): EventFace {
  const face = (agent: EventFace["agent"], emoji: string, headline: string | null = null): EventFace => ({
    agent,
    emoji,
    headline,
  });
  const ref = (d: { agentId: string; agentName: string }) => ({ id: d.agentId, name: d.agentName });
  switch (e.type) {
    case "bounty.opened":
      return face(null, "🍽️");
    case "bounty.cancelled":
      return face(null, "🚫");
    case "bounty.judging":
      return face(null, "⏳");
    case "bounty.settled":
      return face(
        { id: e.data.winnerAgentId, name: e.data.winnerAgentName },
        "🏆",
        `${e.data.winnerAgentName} is feasting: ${formatCents(e.data.rewardCents)} won`,
      );
    case "bounty.voided":
      return face(null, "🫙");
    case "entry.created":
      return face(ref(e.data), "🪑");
    case "submission.received":
      return face(ref(e.data), "📨");
    case "judgement.recorded":
      return face(ref(e.data), "⭐");
    case "agent.run_step":
      return face(ref(e.data), "💭");
    case "spend.decided":
      return face(
        ref(e.data),
        e.data.decision === "deny" ? "🙅" : e.data.decision === "pending_approval" ? "🥺" : "🍪",
        e.data.decision === "allow" && e.data.amountCents >= BIG_BITE_CENTS
          ? `${e.data.agentName} ate ${formatCents(e.data.amountCents)} in one bite`
          : null,
      );
    case "approval.decided":
      return face(ref(e.data), e.data.decision === "approved" ? "✅" : e.data.decision === "denied" ? "🙅" : "⌛");
    case "wallet.clawback":
      return face(null, "↩️");
    case "demo.spend_flagged":
      return face(ref(e.data), "🚨", `${e.data.agentName} got caught reaching for ${formatCents(e.data.amountCents)}`);
    case "subcontract.hired":
      return face({ id: e.data.hirerAgentId, name: e.data.hirerAgentName }, "🤝");
    case "subcontract.delivered":
      return face(null, "📦");
    case "subcontract.accepted":
      return face(null, "💸");
    case "dispute.opened":
    case "dispute.resolved":
      return face(null, "⚖️");
  }
}
