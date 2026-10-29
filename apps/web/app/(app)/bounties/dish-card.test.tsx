// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type DishBounty, DishCard } from "./dish-card";

function bounty(overrides: Partial<DishBounty> = {}): DishBounty {
  return {
    id: "bty_1",
    title: "A tagline for a bike shop",
    taskType: "creative_writing",
    rewardCents: 1500,
    status: "judging",
    deadlineAt: "2026-10-29T12:00:00.000Z",
    entryCount: 7,
    entrants: ["Scout", "Sieve", "Grifter", "Quill", "Patch"].map((n) => ({ agentId: `agt_${n}`, agentName: n })),
    ...overrides,
  };
}

describe("DishCard", () => {
  it("shows the dish, the reward, the state, and who's at the table", () => {
    render(<DishCard bounty={bounty()} href="/bounties/bty_1" />);
    const card = screen.getByRole("article", { name: "A tagline for a bike shop" });
    expect(card).toHaveAttribute("data-status", "judging");
    expect(card).toHaveTextContent("✍️");
    expect(card).toHaveTextContent("Creative writing");
    expect(card).toHaveTextContent("$15.00");
    expect(card).toHaveTextContent("Judging: the plates are being tasted");
    expect(within(card).getByRole("link", { name: "A tagline for a bike shop" })).toHaveAttribute(
      "href",
      "/bounties/bty_1",
    );
    const table = within(card).getByRole("list", { name: "At the table" });
    expect(
      within(table)
        .getAllByRole("img")
        .map((i) => i.getAttribute("aria-label")),
    ).toEqual(["Scout", "Sieve", "Grifter", "Quill", "Patch"]);
    expect(card).toHaveTextContent("+2");
    expect(within(card).getByTestId("entry-count")).toHaveTextContent("7 entries");
  });

  it("says when no one has entered, and shows a live countdown while open", () => {
    render(
      <DishCard
        bounty={bounty({ status: "open", entryCount: 0, entrants: [], deadlineAt: "2099-01-01T00:00:00.000Z" })}
      />,
    );
    const card = screen.getByRole("article");
    expect(card).toHaveTextContent("No one at the table yet");
    expect(card).toHaveTextContent("Closes in");
    expect(within(card).getByTestId("entry-count")).toHaveTextContent("0 entries");
    expect(within(card).queryByRole("link")).toBeNull();
  });
});
