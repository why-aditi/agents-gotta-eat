"use client";

// The arena's live column: the latest 100 events, newest first, as plain text. Bounty and entry events also
// re-render the server-loaded bounty cards (debounced).
import type { ArenaEvent } from "@gottaeat/schemas";
import { RadioIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { EventFeedList } from "@/components/event-feed";
import { useDebouncedRefresh } from "@/components/live-refresh";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvents } from "@/lib/use-events";
import { describeEvent, eventFace } from "./describe";

export const FEED_SIZE = 100;

const changesCards = (e: ArenaEvent) => e.type.startsWith("bounty.") || e.type === "entry.created";

export function LiveFeed({ viewerId }: { viewerId: string | null }) {
  const [events, setEvents] = useState<ArenaEvent[]>([]);
  const refresh = useDebouncedRefresh(1000);
  const onEvent = useCallback(
    (e: ArenaEvent) => {
      setEvents((prev) => {
        if (prev.some((p) => p.id === e.id)) return prev;
        return [e, ...prev].sort((a, b) => b.id - a.id).slice(0, FEED_SIZE);
      });
      if (changesCards(e)) refresh();
    },
    [refresh],
  );
  useEvents({ tail: FEED_SIZE, onEvent });

  return (
    <Card className="lg:sticky lg:top-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RadioIcon className="size-4 text-red-500" aria-hidden />
          Live
        </CardTitle>
        <CardDescription>Entries, agent decisions, spends and results as they happen.</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Waiting for activity…
          </p>
        ) : (
          <EventFeedList
            label="Live events"
            lines={events.map((e) => ({
              id: e.id,
              createdAt: e.createdAt,
              text: describeEvent(e, viewerId),
              face: eventFace(e),
              highlight: e.scope === "owner",
            }))}
          />
        )}
      </CardContent>
    </Card>
  );
}
