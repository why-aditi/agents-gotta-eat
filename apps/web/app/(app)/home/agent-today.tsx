// ui-02: one agent on the Today page: its face, name, and how much of today's cap it has used.
import type { Agent } from "@gottaeat/schemas";
import Link from "next/link";
import { AgentAvatar } from "@/components/app/agent-avatar";
import { Money } from "@/components/app/money";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

// Whole percent of the cap used, 0 to 100; null without a cap.
export function capUsedPct(spentCents: number, capCents: number | null): number | null {
  if (capCents === null || capCents <= 0) return null;
  return Math.min(100, Math.floor((spentCents * 100) / capCents));
}

export function AgentToday({ agent }: { agent: Agent }) {
  const spent = agent.today?.spentCents ?? 0;
  const cap = agent.today?.dailyCapCents ?? null;
  const pct = capUsedPct(spent, cap);
  return (
    <Link
      href={`/agents/${encodeURIComponent(agent.id)}`}
      className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-muted/60"
    >
      <AgentAvatar id={agent.id} name={agent.name} house={agent.kind === "house"} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium">{agent.name}</span>
          <span className="shrink-0 text-sm text-muted-foreground">
            <Money cents={spent} className="text-foreground" />
            {cap !== null ? ` of ${formatCents(cap)}` : " today"}
          </span>
        </div>
        {pct !== null ? (
          <div
            role="meter"
            aria-label={`${agent.name}: today's spend against its daily cap`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn("h-full rounded-full", pct >= 90 ? "bg-deny" : pct >= 70 ? "bg-flag" : "bg-allow")}
              style={{ width: `${pct}%` }}
            />
          </div>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground">No daily cap yet. Give it a mandate.</p>
        )}
      </div>
    </Link>
  );
}
