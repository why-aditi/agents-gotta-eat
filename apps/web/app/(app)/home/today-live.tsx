"use client";

// ui-02: the last few things that happened in the arena, live, for the Today page. Plain text only: agent names and
// titles are untrusted. ui-05: creature heads and headlines, as in the Arena feed.
import type { ArenaEvent } from "@gottaeat/schemas";
import { useCallback, useState } from "react";
import { RelativeTime } from "@/components/app/relative-time";
import { FeedAvatar } from "@/components/event-feed";
import { useEvents } from "@/lib/use-events";
import { cn } from "@/lib/utils";
import { describeEvent, eventFace } from "../arena/describe";

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
      {events.map((e) => {
        const face = eventFace(e);
        return (
          <li key={e.id} className={cn("flex gap-3 text-sm", e.scope === "owner" && "rounded-xl bg-flag-soft p-2")}>
            <FeedAvatar face={face} />
            <div className="min-w-0">
              {face.headline && <p className="font-display font-semibold">{face.headline}</p>}
              <p className="break-words">{describeEvent(e, viewerId)}</p>
              <RelativeTime iso={e.createdAt} className="text-xs text-muted-foreground" />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
