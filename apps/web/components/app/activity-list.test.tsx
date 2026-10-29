// @vitest-environment jsdom
import type { WalletActivityItem } from "@gottaeat/schemas";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityList, earnedSince } from "./activity-list";

function item(overrides: Partial<WalletActivityItem>): WalletActivityItem {
  return {
    id: "jnl_1",
    kind: "topup",
    amountCents: 2500,
    label: "Added money from PayPal",
    agentId: null,
    agentName: null,
    bountyId: null,
    createdAt: "2026-10-29T10:00:00.000Z",
    ...overrides,
  };
}

const ITEMS = [
  item({ id: "j3", kind: "earning", amountCents: 12000, label: "Won a bounty", agentId: "agt_s", agentName: "Scout" }),
  item({
    id: "j2",
    kind: "spend",
    amountCents: -400,
    label: "Paid for a tool",
    agentId: "agt_v",
    agentName: "<b>Sieve</b>",
  }),
  item({ id: "j1", createdAt: "2026-10-28T09:00:00.000Z" }),
];

describe("ActivityList", () => {
  it("shows signed amounts, labels and agent names as plain text", () => {
    const { container } = render(<ActivityList items={ITEMS} empty="Nothing yet" />);
    const rows = screen.getAllByTestId("activity-item");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Won a bounty");
    expect(rows[0]).toHaveTextContent("+$120.00");
    expect(rows[1]).toHaveTextContent("-$4.00");
    expect(within(rows[1]!).getByText("<b>Sieve</b>")).toBeInTheDocument();
    expect(container.querySelector("b")).toBeNull();
  });

  it("groups by day when asked", () => {
    render(<ActivityList items={ITEMS} empty="Nothing yet" grouped />);
    expect(screen.getByRole("region", { name: "Oct 29, 2026" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Oct 28, 2026" })).toBeInTheDocument();
  });

  it("says what an empty list means", () => {
    render(<ActivityList items={[]} empty="Nothing yet. Top up to start." />);
    expect(screen.getByText("Nothing yet. Top up to start.")).toBeInTheDocument();
  });

  it("adds up earnings since a time", () => {
    expect(earnedSince(ITEMS, Date.parse("2026-10-29T00:00:00.000Z"))).toBe(12000);
    expect(earnedSince(ITEMS, Date.parse("2026-10-30T00:00:00.000Z"))).toBe(0);
  });
});
