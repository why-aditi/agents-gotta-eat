"use client";

// ui-02: the last few things that happened in the arena, live, for the Today page. Plain text only: agent names and
// titles are untrusted.
import type { ArenaEvent } from "@gottaeat/schemas";
import { useCallback, useState } from "react";
import { RelativeTime } from "@/components/app/relative-time";
import { useEvents } from "@/lib/use-events";
import { cn } from "@/lib/utils";
import { describeEvent } from "../arena/describe";

const SIZE = 6;

export function TodayLive({ viewerId }: { viewerId: string | null }) {
  const [events, setEvents] = useState<ArenaEvent[]>([]);
  const onEvent = useCallback((e: ArenaEvent) => {
    setEvents((prev) =>
      prev.some((p) => p.id === e.id) ? prev : [e, ...prev].sort((a, b) => b.id - a.id).slice(0, SIZE),
    );
  }, []);
  useEvents({ tail: SIZE, onEvent });

  if (events.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">Quiet right now. New bounties show up here.</p>
    );
  }
  return (
    <ol aria-label="Live in the arena" className="space-y-3">
      {events.map((e) => (
        <li key={e.id} className="flex gap-3 text-sm">
          <span
            aria-hidden
            className={cn("mt-1.5 size-2 shrink-0 rounded-full", e.scope === "owner" ? "bg-flag" : "bg-allow")}
          />
          <div className="min-w-0">
            <p className="break-words">{describeEvent(e, viewerId)}</p>
            <RelativeTime iso={e.createdAt} className="text-xs text-muted-foreground" />
          </div>
        </li>
      ))}
    </ol>
  );
}
