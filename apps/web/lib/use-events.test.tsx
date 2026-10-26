// @vitest-environment jsdom
import type { ArenaEvent } from "@gottaeat/schemas";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeEventSource, runStep } from "@/test/fake-event-source";
import { eventsUrl, parseEvent, useEvents } from "./use-events";

function Probe({ bountyId, onEvent }: { bountyId?: string; onEvent: (e: ArenaEvent) => void }) {
  useEvents({ bountyId, onEvent });
  return null;
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
});
afterEach(() => vi.unstubAllGlobals());

describe("useEvents", () => {
  it("opens /api/events with the bounty filter and passes parsed events on", () => {
    const onEvent = vi.fn();
    render(<Probe bountyId="bty 1" onEvent={onEvent} />);
    const source = FakeEventSource.latest();
    expect(source.url).toBe("/api/events?bountyId=bty+1");
    const e = runStep("EV $14.50");
    source.emitEvent(e);
    expect(onEvent).toHaveBeenCalledWith(e);
  });

  it("ignores junk: bad JSON, the wrong shape, float cents", () => {
    const onEvent = vi.fn();
    render(<Probe onEvent={onEvent} />);
    const source = FakeEventSource.latest();
    source.emit("agent.run_step", "not json");
    source.emit("agent.run_step", JSON.stringify({ id: 1, type: "agent.run_step" }));
    source.emit(
      "bounty.opened",
      JSON.stringify({
        id: 2,
        type: "bounty.opened",
        createdAt: "2026-10-26T12:00:00.000Z",
        scope: "public",
        ownerId: null,
        bountyId: "b",
        data: {
          bountyId: "b",
          title: "T",
          taskType: "extract_data",
          rewardCents: 1.5,
          deadlineAt: "2026-10-27T00:00:00.000Z",
        },
      }),
    );
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("closes the stream on unmount", () => {
    const { unmount } = render(<Probe onEvent={vi.fn()} />);
    const source = FakeEventSource.latest();
    expect(source.closed).toBe(false);
    unmount();
    expect(source.closed).toBe(true);
  });

  it("uses the latest callback without reconnecting", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Probe onEvent={first} />);
    rerender(<Probe onEvent={second} />);
    expect(FakeEventSource.instances).toHaveLength(1);
    FakeEventSource.latest().emitEvent(runStep("x"));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe("eventsUrl and parseEvent", () => {
  it("builds the query", () => {
    expect(eventsUrl({})).toBe("/api/events");
    expect(eventsUrl({ bountyId: "b", tail: 100 })).toBe("/api/events?bountyId=b&tail=100");
  });

  it("returns null for anything that isn't an event", () => {
    expect(parseEvent(undefined)).toBeNull();
    expect(parseEvent("[]")).toBeNull();
    const e = runStep("ok");
    expect(parseEvent(JSON.stringify(e))).toEqual(e);
  });
});
