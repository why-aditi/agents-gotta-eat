// @vitest-environment jsdom
import type { Agent } from "@gottaeat/schemas";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "./test-polyfills";

vi.mock("./actions", () => ({ registerAgent: vi.fn(), rotateKey: vi.fn(), revokeKey: vi.fn() }));

import { AgentCard } from "./agent-card";

function agent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agt_scout",
    ownerId: "usr_1",
    name: "Scout",
    kind: "house",
    status: "active",
    rating: 42,
    skills: [],
    completedJobs: 3,
    apiKeyPrefix: "gte_agent_abcd",
    createdAt: "2026-10-28T10:00:00.000Z",
    today: { spentCents: 720, dailyCapCents: 1000 },
    ...overrides,
  };
}

describe("AgentCard", () => {
  it("shows the creature in its mood, today's plate, its record and its key", () => {
    render(<AgentCard agent={agent()} mood="peckish" />);
    const card = screen.getByRole("article", { name: "Scout" });
    expect(card).toHaveAttribute("data-mood", "peckish");
    expect(within(card).getByRole("link", { name: "Scout" })).toHaveAttribute("href", "/agents/agt_scout");
    expect(card).toHaveTextContent("Eyeing the snacks");
    expect(within(card).getByRole("meter", { name: /Scout/ })).toHaveAttribute("aria-valuenow", "72");
    expect(card).toHaveTextContent("$7.20 of $10.00 eaten today");
    expect(card).toHaveTextContent("4.2");
    expect(card).toHaveTextContent("3");
    expect(card).toHaveTextContent("gte_agent_abcd…");
    expect(card).toHaveTextContent("house");
    expect(within(card).getByRole("button", { name: "Actions for Scout" })).toBeInTheDocument();
  });

  it("says when the key is revoked and when the agent isn't active, and has no meter without a diet", () => {
    render(
      <AgentCard
        agent={agent({ kind: "external", apiKeyPrefix: null, status: "suspended", today: { spentCents: 0, dailyCapCents: null } })}
        mood="sleeping"
      />,
    );
    const card = screen.getByRole("article", { name: "Scout" });
    expect(card).toHaveTextContent("key revoked");
    expect(card).toHaveTextContent("suspended");
    expect(card).not.toHaveTextContent("house");
    expect(card).toHaveTextContent("No diet yet: give it a mandate");
    expect(within(card).queryByRole("meter")).toBeNull();
  });

  it("calls an agent with no jobs and no rating new", () => {
    render(<AgentCard agent={agent({ rating: 0, completedJobs: 0 })} mood="fed" />);
    expect(screen.getByRole("article", { name: "Scout" })).toHaveTextContent("RatingNew");
  });
});
