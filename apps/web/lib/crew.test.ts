import type { Agent } from "@gottaeat/schemas";
import { describe, expect, it } from "vitest";
import { crewMoods } from "./crew";

const NOW = Date.parse("2026-10-29T12:00:00.000Z");

function agent(id: string, overrides: Partial<Agent> = {}): Agent {
  return {
    id,
    ownerId: "usr_1",
    name: id,
    kind: "external",
    status: "active",
    rating: 40,
    skills: [],
    completedJobs: 0,
    apiKeyPrefix: "gte_agent_abcd",
    createdAt: "2026-10-28T10:00:00.000Z",
    today: { spentCents: 0, dailyCapCents: 1000 },
    ...overrides,
  };
}

const win = (agentId: string, createdAt: string) => ({ kind: "earning" as const, agentId, createdAt });

describe("crewMoods", () => {
  it("gives each agent its own mood from its own state", () => {
    const moods = crewMoods(
      [
        agent("agt_begs"),
        agent("agt_won"),
        agent("agt_hungry", { today: { spentCents: 950, dailyCapCents: 1000 } }),
        agent("agt_new", { today: { spentCents: 0, dailyCapCents: null } }),
        agent("agt_fed"),
      ],
      [{ agentId: "agt_begs" }],
      [win("agt_won", "2026-10-29T08:00:00.000Z")],
      NOW,
    );
    expect(moods.map((m) => [m.agent.id, m.mood])).toEqual([
      ["agt_begs", "begging"],
      ["agt_won", "feasting"],
      ["agt_hungry", "hungry"],
      ["agt_new", "sleeping"],
      ["agt_fed", "fed"],
    ]);
  });

  it("only counts a win from the last day", () => {
    const [old] = crewMoods([agent("agt_1")], [], [win("agt_1", "2026-10-27T08:00:00.000Z")], NOW);
    expect(old!.mood).toBe("fed");
  });

  it("puts a suspended agent to sleep", () => {
    const [s] = crewMoods([agent("agt_1", { status: "suspended" })], [{ agentId: "agt_1" }], [], NOW);
    expect(s!.mood).toBe("sleeping");
  });
});
