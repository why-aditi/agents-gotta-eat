// The list of feed lines shared by the live arena, Today and the /demo replay. Every line is plain React text: agent
// names, titles and summaries are untrusted and never reach the page as HTML. ui-05: each line carries the agent's
// creature head (or an emoji tile), and the big moments a headline above the unchanged plain line.
import type { EventFace } from "@/app/(app)/arena/describe";
import { Creature } from "@/components/creature/creature";
import { cn } from "@/lib/utils";

export interface FeedLine {
  id: number;
  createdAt: string;
  text: string;
  face?: EventFace;
  // Highlighted: owner-scoped events, and the demo's flagged spend.
  highlight?: boolean;
}

const TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function FeedAvatar({ face }: { face?: EventFace }) {
  if (!face) return null;
  return (
    <span className="relative size-9 shrink-0">
      {face.agent ? (
        <Creature
          id={face.agent.id}
          name={face.agent.name}
          mood={face.headline ? "feasting" : "fed"}
          size="sm"
          crop="head"
          still
          className="size-9"
        />
      ) : (
        <span className="flex size-9 items-center justify-center rounded-full bg-muted text-base" aria-hidden>
          {face.emoji}
        </span>
      )}
      {face.agent && (
        <span
          aria-hidden
          className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-card text-[0.7rem] ring-1 ring-border"
        >
          {face.emoji}
        </span>
      )}
    </span>
  );
}

export function EventFeedList({ lines, label }: { lines: FeedLine[]; label: string }) {
  return (
    <ol aria-label={label} className="max-h-[70vh] space-y-2 overflow-y-auto pr-1" data-testid="live-feed">
      {lines.map((line) => (
        <li
          key={line.id}
          data-headline={line.face?.headline ? "true" : undefined}
          className={cn(
            "flex items-start gap-3 rounded-xl border px-3 py-2 text-sm break-words",
            line.highlight && "border-flag/40 bg-flag-soft",
            line.face?.headline && !line.highlight && "border-allow/40 bg-allow-soft",
          )}
        >
          <FeedAvatar face={line.face} />
          <div className="min-w-0 flex-1">
            {line.face?.headline && <p className="font-display font-semibold">{line.face.headline}</p>}
            <p>{line.text}</p>
            <time dateTime={line.createdAt} className="font-mono text-xs text-muted-foreground tabular-nums">
              {TIME.format(new Date(line.createdAt))}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}
