"use client";

// Live api events in the browser. EventSource talks to /api/events (same origin, the session cookie); the Next
// server holds the api token. Each message is parsed with ArenaEvent; anything that doesn't parse is ignored.
import { ArenaEvent, ArenaEventType } from "@gottaeat/schemas";
import { useEffect, useRef } from "react";

export interface UseEventsOptions {
  bountyId?: string;
  // On the first connect, replay the latest `tail` events (at most 100). Reconnects resume from Last-Event-ID.
  tail?: number;
  onEvent: (event: ArenaEvent) => void;
}

export function eventsUrl(opts: { bountyId?: string; tail?: number }): string {
  const q = new URLSearchParams();
  if (opts.bountyId) q.set("bountyId", opts.bountyId);
  if (opts.tail) q.set("tail", String(opts.tail));
  const s = q.toString();
  return s ? `/api/events?${s}` : "/api/events";
}

// The parsed event, or null for anything that isn't a valid ArenaEvent.
export function parseEvent(data: unknown): ArenaEvent | null {
  if (typeof data !== "string") return null;
  try {
    const parsed = ArenaEvent.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function useEvents({ bountyId, tail, onEvent }: UseEventsOptions): void {
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  }, [onEvent]);

  const url = eventsUrl({ bountyId, tail });
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const source = new EventSource(url);
    const listener = (message: MessageEvent) => {
      const event = parseEvent(message.data);
      if (event) handler.current(event);
    };
    // Messages are named by type, so each type needs its own listener.
    for (const type of ArenaEventType.options) source.addEventListener(type, listener);
    return () => {
      for (const type of ArenaEventType.options) source.removeEventListener(type, listener);
      source.close();
    };
  }, [url]);
}
