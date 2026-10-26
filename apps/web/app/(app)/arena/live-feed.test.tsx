// @vitest-environment jsdom
import type { ArenaEvent } from "@gottaeat/schemas";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeEventSource, runStep } from "@/test/fake-event-source";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const { LiveFeed } = await import("./live-feed");

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
  refresh.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const opened = (id: number): ArenaEvent => ({
  id,
  type: "bounty.opened",
  createdAt: "2026-10-26T12:00:00.000Z",
  scope: "public",
  ownerId: null,
  bountyId: "bty_9",
  data: {
    bountyId: "bty_9",
    title: "Extract line items from three invoices",
    taskType: "extract_data",
    rewardCents: 2500,
    deadlineAt: "2026-10-27T12:00:00.000Z",
  },
});

describe("LiveFeed", () => {
  it("asks for the latest 100 and shows the waiting state", () => {
    render(<LiveFeed viewerId="usr_me" />);
    expect(FakeEventSource.latest().url).toBe("/api/events?tail=100");
    expect(screen.getByText("Waiting for activity…")).toBeInTheDocument();
  });

  it("renders an agent's <script> summary as text, never as HTML", () => {
    const { container } = render(<LiveFeed viewerId="usr_me" />);
    const evil = '<script>alert("pwned")</script><img src=x onerror=alert(1)>';
    act(() => FakeEventSource.latest().emitEvent(runStep(evil)));
    expect(screen.getByText(`Sieve: enter decision — ${evil}`, { exact: false })).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows newest first, once per event id", () => {
    render(<LiveFeed viewerId="usr_me" />);
    const source = FakeEventSource.latest();
    const a = runStep("first");
    const b = runStep("second");
    act(() => {
      source.emitEvent(a);
      source.emitEvent(b);
      source.emitEvent(a);
    });
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toHaveLength(2);
    expect(items[0]).toContain("second");
    expect(items[1]).toContain("first");
  });

  it("phrases owner events for the viewer", () => {
    render(<LiveFeed viewerId="usr_me" />);
    act(() =>
      FakeEventSource.latest().emitEvent({
        id: 500,
        type: "spend.decided",
        createdAt: "2026-10-26T12:00:00.000Z",
        scope: "owner",
        ownerId: "usr_me",
        bountyId: null,
        data: {
          spendRequestId: "spr_1",
          agentId: "agt_g",
          agentName: "Grifter",
          bountyId: null,
          amountCents: 4000,
          category: "tool",
          decision: "pending_approval",
          reasons: ["intent_ask"],
        },
      }),
    );
    expect(screen.getByText(/Your agent Grifter's \$40\.00 tool spend is waiting for approval/)).toBeInTheDocument();
  });

  it("refreshes the cards once (debounced) on bounty and entry events, not on run steps", () => {
    vi.useFakeTimers();
    render(<LiveFeed viewerId={null} />);
    const source = FakeEventSource.latest();
    act(() => source.emitEvent(runStep("thinking")));
    act(() => vi.advanceTimersByTime(1500));
    expect(refresh).not.toHaveBeenCalled();
    act(() => {
      source.emitEvent(opened(1000));
      source.emitEvent(opened(1001));
    });
    act(() => vi.advanceTimersByTime(1500));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText(/New bounty “Extract line items from three invoices”: \$25\.00 reward/)).toHaveLength(2);
  });
});
