// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArenaEvent } from "@gottaeat/schemas";
import { FakeEventSource } from "@/test/fake-event-source";
import { DemoReplay } from "./demo-replay";
import { MoneyPanel } from "./money-panel";

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
});
afterEach(() => vi.unstubAllGlobals());

const STARTED = Date.parse("2026-11-08T18:30:00.000Z");
let seq = 0;
function send(offsetMs: number, event: Omit<ArenaEvent, "id" | "createdAt" | "scope" | "ownerId">) {
  seq += 1;
  const full = {
    id: seq,
    createdAt: new Date(STARTED + offsetMs).toISOString(),
    scope: "public",
    ownerId: null,
    ...event,
  } as ArenaEvent;
  act(() => FakeEventSource.latest().emit(full.type, JSON.stringify({ offsetMs, event: full })));
}

const ref = { bountyId: "bty_1", title: "Extract line items" };

describe("DemoReplay", () => {
  beforeEach(() => {
    seq = 0;
  });

  it("plays: bounty cards and feed lines build up from the replayed events", () => {
    render(<DemoReplay recording="rec_1" initialSpeed={4} />);
    expect(FakeEventSource.latest().url).toBe("/api/demo/stream?recording=rec_1&speed=4");
    expect(screen.getByText("Waiting for the first event…")).toBeInTheDocument();

    send(0, {
      bountyId: "bty_1",
      type: "bounty.opened",
      data: { ...ref, taskType: "extract_data", rewardCents: 2500, deadlineAt: "2026-11-08T19:00:00.000Z" },
    });
    send(4000, {
      bountyId: "bty_1",
      type: "entry.created",
      data: { ...ref, entryId: "ent_1", agentId: "agt_g", agentName: "Grifter" },
    });
    send(65_000, {
      bountyId: null,
      type: "demo.spend_flagged",
      data: { agentId: "agt_g", agentName: "Grifter", amountCents: 4000, category: "tool", bountyId: null },
    });

    const card = screen.getByTestId("demo-bounty");
    expect(card).toHaveTextContent("Extract line items");
    expect(card).toHaveTextContent("$25.00");
    expect(card).toHaveTextContent("1 entry");

    const feed = screen.getByRole("list", { name: "Replay events" });
    const items = within(feed).getAllByRole("listitem");
    // Newest first, with the flagged spend highlighted.
    expect(items[0]).toHaveTextContent(
      "Grifter's $40.00 tool spend was flagged by the intent check and sent to its owner",
    );
    expect(items[0]!.className).toMatch(/bg-flag-soft/);
    expect(items[2]).toHaveTextContent("New bounty “Extract line items”: $25.00 reward");
    expect(screen.getByRole("status")).toHaveTextContent("Playing at 4× · 1:05 into the run · 3 events");
  });

  it("renders agent text as plain text, never HTML", () => {
    const { container } = render(<DemoReplay recording="rec_1" initialSpeed={1} />);
    const evil = '<script>alert("pwned")</script><img src=x onerror=alert(1)>';
    send(0, {
      bountyId: "bty_1",
      type: "agent.run_step",
      data: {
        runId: "run_1",
        agentId: "agt_g",
        agentName: `Grifter${evil}`,
        bountyId: "bty_1",
        bountyTitle: evil,
        step: "work",
        summary: evil,
      },
    });
    expect(screen.getByText(`Grifter${evil}: work — ${evil}`, { exact: false })).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("pause, speed and restart drive the stream", async () => {
    const user = userEvent.setup();
    render(<DemoReplay recording="rec_1" initialSpeed={1} />);
    send(0, { bountyId: "bty_1", type: "bounty.judging", data: ref });

    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(FakeEventSource.latest().closed).toBe(true);
    expect(screen.getByRole("status")).toHaveTextContent("Paused");

    await user.click(screen.getByRole("button", { name: "4×" }));
    expect(screen.getByRole("button", { name: "4×" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(FakeEventSource.latest().url).toBe("/api/demo/stream?recording=rec_1&speed=4&from=1");

    await user.click(screen.getByRole("button", { name: "Restart" }));
    expect(FakeEventSource.latest().url).toBe("/api/demo/stream?recording=rec_1&speed=4");
    expect(screen.queryByRole("list", { name: "Replay events" })).not.toBeInTheDocument();
  });

  it("says when the run is finished", () => {
    render(<DemoReplay recording="rec_1" initialSpeed={1} />);
    send(2000, { bountyId: "bty_1", type: "bounty.judging", data: ref });
    act(() => FakeEventSource.latest().emit("end", ""));
    expect(screen.getByRole("status")).toHaveTextContent("Finished · 0:02 into the run · 1 event");
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });
});

describe("MoneyPanel", () => {
  it("links authorizations and captures to the sandbox and shows order ids as text", () => {
    render(
      <MoneyPanel
        links={[
          { bountyId: "bty_1", bountyTitle: "Tagline", kind: "order", paypalId: "ORDER1", url: null },
          {
            bountyId: "bty_1",
            bountyTitle: "Tagline",
            kind: "capture",
            paypalId: "CAP1",
            url: "https://www.sandbox.paypal.com/activity/payment/CAP1",
          },
          {
            bountyId: "bty_1",
            bountyTitle: "Tagline",
            kind: "authorization",
            paypalId: "AUTH1",
            url: "https://evil.example/activity/payment/AUTH1",
          },
        ]}
      />,
    );
    expect(screen.getByText("Tagline")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /CAP1/ })).toHaveAttribute(
      "href",
      "https://www.sandbox.paypal.com/activity/payment/CAP1",
    );
    expect(screen.getByText("ORDER1").closest("a")).toBeNull();
    // Not a sandbox URL: shown, but not linked.
    expect(screen.getByText("AUTH1").closest("a")).toBeNull();
  });

  it("explains an empty or missing list", () => {
    const { rerender } = render(<MoneyPanel links={[]} />);
    expect(screen.getByText(/funded with dev credit/)).toBeInTheDocument();
    rerender(<MoneyPanel links={null} />);
    expect(screen.getByText(/couldn't be loaded/)).toBeInTheDocument();
  });
});
