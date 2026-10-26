"use client";

// The arena's live column: the latest 100 events, newest first, as plain text. Bounty and entry events also
// re-render the server-loaded bounty cards (debounced).
import type { ArenaEvent } from "@gottaeat/schemas";
import { RadioIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { useDebouncedRefresh } from "@/components/live-refresh";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvents } from "@/lib/use-events";
import { cn } from "@/lib/utils";
import { describeEvent } from "./describe";

export const FEED_SIZE = 100;

const TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

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
          <ol aria-label="Live events" className="max-h-[70vh] space-y-2 overflow-y-auto pr-1" data-testid="live-feed">
            {events.map((e) => (
              <li
                key={e.id}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm break-words",
                  e.scope === "owner" && "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
                )}
              >
                <time dateTime={e.createdAt} className="mr-2 font-mono text-xs text-muted-foreground tabular-nums">
                  {TIME.format(new Date(e.createdAt))}
                </time>
                {describeEvent(e, viewerId)}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
