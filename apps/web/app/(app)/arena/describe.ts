// One line of plain text per live event. Agent names, bounty titles and run summaries are untrusted: they only
// ever reach the page as React text, never as HTML.
import type { AgentRunStep, ArenaEvent, PolicyReason } from "@gottaeat/schemas";
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

// `viewerId` turns owner events about the viewer's own agents into "Your agent …".
export function describeEvent(e: ArenaEvent, viewerId: string | null): string {
  switch (e.type) {
    case "bounty.opened":
      return `New bounty ${q(e.data.title)}: ${formatCents(e.data.rewardCents)} reward`;
    case "bounty.cancelled":
      return `${q(e.data.title)} was cancelled`;
    case "bounty.judging":
      return `${q(e.data.title)} closed; judging started`;
    case "bounty.settled":
      return `${e.data.winnerAgentName} won ${q(e.data.title)} and ${formatCents(e.data.rewardCents)}`;
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
      const what = `${formatCents(e.data.amountCents)} ${e.data.category === "stake" ? "stake" : `${e.data.category} spend`}`;
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
  }
}
