"use client";

// Plays a recorded run from /api/demo/stream (same origin, public). The api does the timing: it sends each event
// when its offset comes, at the chosen speed. Pause closes the stream; play, a speed change, and the proxy's 55 s
// cut-off all reopen it with `from=<last seq rendered>`, so nothing repeats or is skipped. Restart starts over.
import { useCallback, useEffect, useRef, useState } from "react";
import { type ArenaEvent, ArenaEventType, type DemoSpeed, ReplayEvent } from "@gottaeat/schemas";

export type ReplayStatus = "playing" | "paused" | "ended" | "error";

export interface ReplayItem {
  seq: number;
  offsetMs: number;
  event: ArenaEvent;
}

// A dropped stream is reopened after this long; this many drops in a row without a message is an error.
export const RETRY_MS = 1000;
export const MAX_FAILURES = 3;
// Recordings are a few hundred events; this only bounds memory on a pathological one.
const MAX_ITEMS = 5000;

export function replayUrl(opts: { recording?: string | null; speed: DemoSpeed; from?: number }): string {
  const q = new URLSearchParams();
  if (opts.recording) q.set("recording", opts.recording);
  q.set("speed", String(opts.speed));
  if (opts.from) q.set("from", String(opts.from));
  return `/api/demo/stream?${q.toString()}`;
}

// The parsed replay message, or null for anything that isn't one.
export function parseReplay(data: unknown): ReplayEvent | null {
  if (typeof data !== "string") return null;
  try {
    const parsed = ReplayEvent.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export interface UseReplayOptions {
  // Omitted: the featured recording.
  recording?: string | null;
  initialSpeed?: DemoSpeed;
  autoplay?: boolean;
}

export interface Replay {
  items: ReplayItem[];
  status: ReplayStatus;
  speed: DemoSpeed;
  setSpeed: (speed: DemoSpeed) => void;
  play: () => void;
  pause: () => void;
  restart: () => void;
}

export function useReplay({ recording, initialSpeed = 1, autoplay = true }: UseReplayOptions = {}): Replay {
  const [items, setItems] = useState<ReplayItem[]>([]);
  const [status, setStatus] = useState<ReplayStatus>(autoplay ? "playing" : "paused");
  const [speed, setSpeed] = useState<DemoSpeed>(initialSpeed);
  // Bumped to reopen the stream without any other state change (restart, reconnect).
  const [generation, setGeneration] = useState(0);
  const lastSeq = useRef(0);
  const failures = useRef(0);

  useEffect(() => {
    if (status !== "playing" || typeof EventSource === "undefined") return;
    const source = new EventSource(replayUrl({ recording, speed, from: lastSeq.current }));
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const onMessage = (message: MessageEvent) => {
      const replay = parseReplay(message.data);
      if (!replay) return;
      const seq = replay.event.id;
      failures.current = 0;
      if (seq <= lastSeq.current) return;
      lastSeq.current = seq;
      setItems((prev) => [...prev, { seq, offsetMs: replay.offsetMs, event: replay.event }].slice(-MAX_ITEMS));
    };
    const close = () => {
      closed = true;
      for (const type of ArenaEventType.options) source.removeEventListener(type, onMessage);
      source.removeEventListener("end", onEnd);
      source.removeEventListener("error", onError);
      source.close();
    };
    function onEnd() {
      close();
      setStatus("ended");
    }
    // A closed stream (the proxy's 55 s limit, a network drop, a 404) fires error. Reopen from the last seq;
    // EventSource's own reconnect is stopped by close().
    function onError() {
      if (closed) return;
      close();
      failures.current += 1;
      if (failures.current >= MAX_FAILURES) {
        setStatus("error");
        return;
      }
      retry = setTimeout(() => setGeneration((g) => g + 1), RETRY_MS);
    }

    // Messages are named by type, so each type needs its own listener.
    for (const type of ArenaEventType.options) source.addEventListener(type, onMessage);
    source.addEventListener("end", onEnd);
    source.addEventListener("error", onError);
    return () => {
      clearTimeout(retry);
      if (!closed) close();
    };
  }, [recording, speed, status, generation]);

  const restart = useCallback(() => {
    lastSeq.current = 0;
    failures.current = 0;
    setItems([]);
    setStatus("playing");
    setGeneration((g) => g + 1);
  }, []);

  const play = useCallback(() => {
    if (status === "ended") return restart();
    failures.current = 0;
    setStatus("playing");
    if (status === "error") setGeneration((g) => g + 1);
  }, [status, restart]);

  const pause = useCallback(() => setStatus((s) => (s === "playing" ? "paused" : s)), []);

  return { items, status, speed, setSpeed, play, pause, restart };
}
