// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeEventSource } from "@/test/fake-event-source";
import type { FeedEvent } from "./demo-schemas";
import { MAX_FAILURES, parseReplay, RETRY_MS, replayUrl, useReplay } from "./use-replay";

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const STARTED = Date.parse("2026-10-26T12:00:00.000Z");

function step(seq: number, offsetMs: number, summary = `step ${seq}`): { offsetMs: number; event: FeedEvent } {
  return {
    offsetMs,
    event: {
      id: seq,
      type: "agent.run_step",
      createdAt: new Date(STARTED + offsetMs).toISOString(),
      scope: "public",
      ownerId: null,
      bountyId: "bty_1",
      data: {
        runId: `run_${seq}`,
        agentId: "agt_sieve",
        agentName: "Sieve",
        bountyId: "bty_1",
        bountyTitle: "Extract line items",
        step: "work",
        summary,
      },
    },
  };
}

function send(source: FakeEventSource, msg: { offsetMs: number; event: FeedEvent }) {
  act(() => source.emit(msg.event.type, JSON.stringify(msg)));
}

describe("useReplay", () => {
  it("autoplays the recording at the initial speed and collects events in order", () => {
    const { result } = renderHook(() => useReplay({ recording: "rec_1", initialSpeed: 4 }));
    const source = FakeEventSource.latest();
    expect(source.url).toBe("/api/demo/stream?recording=rec_1&speed=4");
    send(source, step(1, 0));
    send(source, step(2, 1500));
    expect(result.current.status).toBe("playing");
    expect(result.current.items.map((i) => [i.seq, i.offsetMs])).toEqual([
      [1, 0],
      [2, 1500],
    ]);
  });

  it("omits the recording for the featured one and starts paused without autoplay", () => {
    const { result } = renderHook(() => useReplay({ autoplay: false }));
    expect(FakeEventSource.instances).toHaveLength(0);
    expect(result.current.status).toBe("paused");
    act(() => result.current.play());
    expect(FakeEventSource.latest().url).toBe("/api/demo/stream?speed=1");
  });

  it("pause closes the stream; play resumes from the last seq rendered", () => {
    const { result } = renderHook(() => useReplay({ recording: "rec_1" }));
    const first = FakeEventSource.latest();
    send(first, step(1, 0));
    send(first, step(2, 100));
    act(() => result.current.pause());
    expect(result.current.status).toBe("paused");
    expect(first.closed).toBe(true);
    act(() => result.current.play());
    const second = FakeEventSource.latest();
    expect(second).not.toBe(first);
    expect(second.url).toBe("/api/demo/stream?recording=rec_1&speed=1&from=2");
  });

  it("changing speed reopens the stream at the new speed from the last seq", () => {
    const { result } = renderHook(() => useReplay({ recording: "rec_1" }));
    const first = FakeEventSource.latest();
    send(first, step(1, 0));
    act(() => result.current.setSpeed(4));
    expect(first.closed).toBe(true);
    expect(FakeEventSource.latest().url).toBe("/api/demo/stream?recording=rec_1&speed=4&from=1");
    expect(result.current.speed).toBe(4);
  });

  it("ignores events it already has and anything that isn't a replay message", () => {
    const { result } = renderHook(() => useReplay({ recording: "rec_1" }));
    const source = FakeEventSource.latest();
    send(source, step(1, 0));
    send(source, step(1, 0));
    act(() => {
      source.emit("agent.run_step", "not json");
      // A bare ArenaEvent (the live stream's shape) is not a replay message.
      source.emit("agent.run_step", JSON.stringify(step(3, 10).event));
      // Float offsets are rejected like float cents.
      source.emit("agent.run_step", JSON.stringify({ ...step(4, 10), offsetMs: 1.5 }));
    });
    expect(result.current.items.map((i) => i.seq)).toEqual([1]);
  });

  it("parses the demo.spend_flagged event", () => {
    const { result } = renderHook(() => useReplay({ recording: "rec_1" }));
    const flagged = {
      offsetMs: 5000,
      event: {
        id: 7,
        type: "demo.spend_flagged",
        createdAt: "2026-10-26T12:00:05.000Z",
        scope: "public",
        ownerId: null,
        bountyId: null,
        data: { agentId: "agt_g", agentName: "Grifter", amountCents: 4000, category: "tool", bountyId: null },
      },
    } as const;
    act(() => FakeEventSource.latest().emit("demo.spend_flagged", JSON.stringify(flagged)));
    expect(result.current.items[0]?.event.type).toBe("demo.spend_flagged");
  });

  it("stops at end, and play after the end restarts from the beginning", () => {
    const { result } = renderHook(() => useReplay({ recording: "rec_1" }));
    const source = FakeEventSource.latest();
    send(source, step(1, 0));
    act(() => source.emit("end", ""));
    expect(result.current.status).toBe("ended");
    expect(source.closed).toBe(true);
    expect(result.current.items).toHaveLength(1);
    act(() => result.current.play());
    expect(result.current.status).toBe("playing");
    expect(result.current.items).toHaveLength(0);
    expect(FakeEventSource.latest().url).toBe("/api/demo/stream?recording=rec_1&speed=1");
  });

  it("restart clears the feed and opens a fresh stream", () => {
    const { result } = renderHook(() => useReplay({ recording: "rec_1" }));
    const first = FakeEventSource.latest();
    send(first, step(1, 0));
    send(first, step(2, 10));
    act(() => result.current.restart());
    expect(first.closed).toBe(true);
    expect(result.current.items).toEqual([]);
    const second = FakeEventSource.latest();
    expect(second.url).toBe("/api/demo/stream?recording=rec_1&speed=1");
    // The api replays from seq 1 again; nothing is dropped as a duplicate.
    send(second, step(1, 0));
    expect(result.current.items).toHaveLength(1);
  });

  it("a dropped stream (the 55 s cut-off) resumes with from=<last seq>", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useReplay({ recording: "rec_1" }));
    const first = FakeEventSource.latest();
    send(first, step(1, 0));
    send(first, step(2, 10));
    act(() => first.emit("error", ""));
    expect(first.closed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(1);
    act(() => vi.advanceTimersByTime(RETRY_MS));
    const second = FakeEventSource.latest();
    expect(second.url).toBe("/api/demo/stream?recording=rec_1&speed=1&from=2");
    send(second, step(3, 20));
    expect(result.current.items.map((i) => i.seq)).toEqual([1, 2, 3]);
    expect(result.current.status).toBe("playing");
  });

  it("gives up after repeated failures without a message, and play tries again", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useReplay({ recording: "rec_missing" }));
    for (let i = 0; i < MAX_FAILURES; i++) {
      act(() => FakeEventSource.latest().emit("error", ""));
      act(() => vi.advanceTimersByTime(RETRY_MS));
    }
    expect(result.current.status).toBe("error");
    expect(FakeEventSource.instances).toHaveLength(MAX_FAILURES);
    act(() => result.current.play());
    expect(result.current.status).toBe("playing");
    expect(FakeEventSource.instances).toHaveLength(MAX_FAILURES + 1);
  });

  it("closes the stream on unmount", () => {
    const { unmount } = renderHook(() => useReplay({ recording: "rec_1" }));
    const source = FakeEventSource.latest();
    unmount();
    expect(source.closed).toBe(true);
  });
});

describe("replayUrl and parseReplay", () => {
  it("builds the query", () => {
    expect(replayUrl({ speed: 1 })).toBe("/api/demo/stream?speed=1");
    expect(replayUrl({ recording: "rec_1", speed: 4, from: 12 })).toBe(
      "/api/demo/stream?recording=rec_1&speed=4&from=12",
    );
  });

  it("returns null for anything that isn't a replay message", () => {
    expect(parseReplay(undefined)).toBeNull();
    expect(parseReplay("{}")).toBeNull();
    const msg = step(1, 0);
    expect(parseReplay(JSON.stringify(msg))).toEqual(msg);
  });
});
