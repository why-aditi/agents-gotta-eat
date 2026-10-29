// ui-04: each agent's mood from the same state everywhere (Today's crew and the Agents page): today's spend against
// its cap, spends waiting on the owner, and a win in the last day.
import type { Agent, SpendRequest, WalletActivityItem } from "@gottaeat/schemas";
import { type Mood, moodFor } from "@/components/creature/mood";

const DAY_MS = 24 * 3600 * 1000;

export function crewMoods(
  agents: Agent[],
  pending: Pick<SpendRequest, "agentId">[],
  items: Pick<WalletActivityItem, "kind" | "agentId" | "createdAt">[],
  now: number,
): { agent: Agent; mood: Mood }[] {
  return agents.map((agent) => ({
    agent,
    mood: moodFor({
      spentCents: agent.today?.spentCents ?? 0,
      capCents: agent.today?.dailyCapCents ?? null,
      pendingApprovals: pending.filter((s) => s.agentId === agent.id).length,
      active: agent.status === "active",
      // A daily cap only exists once a mandate is confirmed.
      hasMandate: agent.today?.dailyCapCents != null,
      recentWin: items.some(
        (i) => i.kind === "earning" && i.agentId === agent.id && Date.parse(i.createdAt) >= now - DAY_MS,
      ),
    }),
  }));
}

// No jobs and no rating yet: say so instead of showing 0.0 stars.
export function unrated(agent: Pick<Agent, "rating" | "completedJobs">): boolean {
  return agent.rating === 0 && agent.completedJobs === 0;
}
