// The list of feed lines shared by the live arena and the /demo replay. Every line is plain React text: agent
// names, titles and summaries are untrusted and never reach the page as HTML.
import { cn } from "@/lib/utils";

export interface FeedLine {
  id: number;
  createdAt: string;
  text: string;
  // Amber: owner-scoped events, and the demo's flagged spend.
  highlight?: boolean;
}

const TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function EventFeedList({ lines, label }: { lines: FeedLine[]; label: string }) {
  return (
    <ol aria-label={label} className="max-h-[70vh] space-y-2 overflow-y-auto pr-1" data-testid="live-feed">
      {lines.map((line) => (
        <li
          key={line.id}
          className={cn(
            "rounded-md border px-3 py-2 text-sm break-words",
            line.highlight && "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
          )}
        >
          <time dateTime={line.createdAt} className="mr-2 font-mono text-xs text-muted-foreground tabular-nums">
            {TIME.format(new Date(line.createdAt))}
          </time>
          {line.text}
        </li>
      ))}
    </ol>
  );
}
