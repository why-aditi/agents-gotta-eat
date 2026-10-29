// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EventFeedList } from "./event-feed";

describe("EventFeedList", () => {
  it("shows each line's creature or emoji, a headline for big moments, and the plain line unchanged", () => {
    render(
      <EventFeedList
        label="Live events"
        lines={[
          {
            id: 2,
            createdAt: "2026-10-29T12:00:05.000Z",
            text: "Scout won “Tagline” and $40.00",
            face: { agent: { id: "agt_s", name: "Scout" }, emoji: "🏆", headline: "Scout is feasting: $40.00 won" },
          },
          {
            id: 1,
            createdAt: "2026-10-29T12:00:00.000Z",
            text: "“Tagline” was voided: no entry passed",
            face: { agent: null, emoji: "🫙", headline: null },
          },
          { id: 0, createdAt: "2026-10-29T11:59:00.000Z", text: "<b>Sieve</b> entered" },
        ]}
      />,
    );
    const [won, voided, plain] = within(screen.getByRole("list", { name: "Live events" })).getAllByRole("listitem");
    expect(won).toHaveAttribute("data-headline", "true");
    expect(won).toHaveTextContent("Scout is feasting: $40.00 won");
    expect(within(won!).getByText("Scout won “Tagline” and $40.00")).toBeInTheDocument();
    expect(won!.querySelector("[data-mood]")).toHaveAttribute("data-mood", "feasting");
    expect(voided).toHaveTextContent("🫙");
    expect(voided).not.toHaveAttribute("data-headline");
    expect(plain).toHaveTextContent("<b>Sieve</b> entered");
    expect(plain!.querySelector("b")).toBeNull();
  });
});
