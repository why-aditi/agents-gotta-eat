"use client";

// The replay itself: controls, bounty cards built from the replayed events, and the feed. Same plain-text rules as
// the live arena: agent names, titles and summaries are untrusted and render only as React text.
import { PauseIcon, PlayIcon, RotateCcwIcon, SwordsIcon } from "lucide-react";
import { describeEvent } from "@/app/(app)/arena/describe";
import { BountyStatusBadge, taskTypeLabel } from "@/app/(app)/bounties/bounty-labels";
import { EventFeedList } from "@/components/event-feed";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_SPEEDS, type DemoSpeed } from "@gottaeat/schemas";
import { deriveBounties, formatOffset, type ReplayBounty } from "@/lib/demo-view";
import { formatCents } from "@/lib/money";
import { type ReplayStatus, useReplay } from "@/lib/use-replay";
import { cn } from "@/lib/utils";

const FEED_SIZE = 100;

function statusLine(status: ReplayStatus, speed: DemoSpeed, offsetMs: number, count: number): string {
  const where = `${formatOffset(offsetMs)} into the run · ${count} ${count === 1 ? "event" : "events"}`;
  switch (status) {
    case "playing":
      return count === 0 ? `Starting at ${speed}×…` : `Playing at ${speed}× · ${where}`;
    case "paused":
      return `Paused · ${where}`;
    case "ended":
      return `Finished · ${where}`;
    case "error":
      return "Couldn't load the replay. Try Restart in a moment.";
  }
}

function ReplayBountyCard({ bounty }: { bounty: ReplayBounty }) {
  return (
    <Card className="gap-3 py-4" data-testid="demo-bounty">
      <CardHeader className="px-4">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="min-w-0 text-base leading-snug break-words">{bounty.title}</CardTitle>
          <BountyStatusBadge status={bounty.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-1 px-4 text-sm">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {bounty.rewardCents !== null && (
            <span className="text-lg font-semibold tabular-nums">{formatCents(bounty.rewardCents)}</span>
          )}
          {bounty.taskType && <span className="text-muted-foreground">{taskTypeLabel(bounty.taskType)}</span>}
          <span className="text-muted-foreground tabular-nums">
            {bounty.entries} {bounty.entries === 1 ? "entry" : "entries"}
          </span>
        </p>
        {bounty.winnerName !== null && <p className="text-muted-foreground">Won by {bounty.winnerName}</p>}
      </CardContent>
    </Card>
  );
}

// `children` renders under the bounty cards (the server-rendered money panel).
export function DemoReplay({
  recording,
  initialSpeed,
  children,
}: {
  recording: string | null;
  initialSpeed: DemoSpeed;
  children?: React.ReactNode;
}) {
  const replay = useReplay({ recording, initialSpeed });
  const { items, status, speed } = replay;
  const bounties = deriveBounties(items.map((i) => i.event));
  const lines = items
    .slice(-FEED_SIZE)
    .reverse()
    .map((i) => ({
      id: i.seq,
      createdAt: i.event.createdAt,
      text: describeEvent(i.event, null),
      highlight: i.event.type === "demo.spend_flagged",
    }));
  const offsetMs = items.at(-1)?.offsetMs ?? 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Replay controls">
          {status === "playing" ? (
            <Button variant="outline" onClick={replay.pause}>
              <PauseIcon aria-hidden /> Pause
            </Button>
          ) : (
            <Button onClick={replay.play}>
              <PlayIcon aria-hidden /> Play
            </Button>
          )}
          <Button variant="outline" onClick={replay.restart}>
            <RotateCcwIcon aria-hidden /> Restart
          </Button>
          <div className="inline-flex rounded-lg bg-muted p-[3px]" role="group" aria-label="Speed">
            {DEMO_SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={s === speed}
                onClick={() => replay.setSpeed(s)}
                className={cn(
                  "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium tabular-nums transition-colors",
                  s === speed
                    ? "bg-background text-foreground shadow-sm dark:bg-input/30"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s}×
              </button>
            ))}
          </div>
          <p
            role="status"
            className={cn("text-sm text-muted-foreground tabular-nums", status === "error" && "text-destructive")}
          >
            {statusLine(status, speed, offsetMs, items.length)}
          </p>
        </div>
        <section aria-label="Bounties" className="space-y-3">
          {bounties.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
              <SwordsIcon className="mx-auto mb-2 size-8" aria-hidden />
              <p>Bounties appear here as the run opens them.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {bounties.map((b) => (
                <ReplayBountyCard key={b.id} bounty={b} />
              ))}
            </div>
          )}
        </section>
        {children}
      </div>
      <Card className="lg:sticky lg:top-6 lg:self-start">
        <CardHeader>
          <CardTitle>Replay feed</CardTitle>
          <CardDescription>Entries, agent decisions, flagged spends and results, as they happened.</CardDescription>
        </CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              {status === "error" ? "Nothing to show yet." : "Waiting for the first event…"}
            </p>
          ) : (
            <EventFeedList label="Replay events" lines={lines} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
