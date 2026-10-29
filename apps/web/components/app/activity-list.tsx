// ui-02: wallet movements as a readable list, grouped by day: what happened, which agent, and the signed amount.
// Labels come from the api and never contain agent text; agent names are untrusted and render as plain text.
import type { WalletActivityItem, WalletActivityKind } from "@gottaeat/schemas";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  BanknoteIcon,
  CircleDollarSignIcon,
  HourglassIcon,
  type LucideIcon,
  RotateCcwIcon,
  SparklesIcon,
  TrophyIcon,
} from "lucide-react";
import { formatDateTime } from "@/app/(app)/_lib/format";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "./agent-avatar";
import { Money } from "./money";
import { RelativeTime } from "./relative-time";

const ICON: Record<WalletActivityKind, { icon: LucideIcon; tone: string }> = {
  topup: { icon: ArrowDownLeftIcon, tone: "bg-paypal-soft text-paypal" },
  credit: { icon: SparklesIcon, tone: "bg-paypal-soft text-paypal" },
  spend: { icon: ArrowUpRightIcon, tone: "bg-muted text-foreground" },
  hold: { icon: HourglassIcon, tone: "bg-flag-soft text-flag" },
  release: { icon: RotateCcwIcon, tone: "bg-muted text-muted-foreground" },
  earning: { icon: TrophyIcon, tone: "bg-allow-soft text-allow" },
  withdrawal: { icon: BanknoteIcon, tone: "bg-paypal-soft text-paypal" },
  refund: { icon: RotateCcwIcon, tone: "bg-muted text-muted-foreground" },
  fee: { icon: CircleDollarSignIcon, tone: "bg-muted text-muted-foreground" },
  other: { icon: CircleDollarSignIcon, tone: "bg-muted text-muted-foreground" },
};

// Money earned (bounty wins, tool sales) since a time, in cents.
export function earnedSince(items: WalletActivityItem[], sinceMs: number): number {
  return items
    .filter((i) => i.kind === "earning" && Date.parse(i.createdAt) >= sinceMs)
    .reduce((sum, i) => sum + i.amountCents, 0);
}

// "Oct 28, 2026" in UTC, the same on server and browser.
function dayOf(iso: string): string {
  return formatDateTime(iso).replace(/, \d{2}:\d{2} UTC$/, "");
}

export function ActivityList({
  items,
  empty,
  grouped = false,
}: {
  items: WalletActivityItem[];
  empty: string;
  grouped?: boolean;
}) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  const groups: { day: string; items: WalletActivityItem[] }[] = [];
  for (const item of items) {
    const day = grouped ? dayOf(item.createdAt) : "";
    const last = groups.at(-1);
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.day || "all"} aria-label={g.day || "Activity"}>
          {g.day && <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{g.day}</h3>}
          <ul className="divide-y">
            {g.items.map((item) => {
              const { icon: Icon, tone } = ICON[item.kind];
              return (
                <li key={item.id} className="flex items-center gap-3 py-3" data-testid="activity-item">
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tone)}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.label}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {item.agentId && item.agentName && (
                        <>
                          <AgentAvatar
                            id={item.agentId}
                            name={item.agentName}
                            size="sm"
                            className="size-4 rounded-md text-[0.5rem]"
                          />
                          <span className="truncate">{item.agentName}</span>
                          <span aria-hidden>·</span>
                        </>
                      )}
                      <RelativeTime iso={item.createdAt} />
                    </p>
                  </div>
                  <Money cents={item.amountCents} signed tone="auto" className="shrink-0 text-sm" />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
