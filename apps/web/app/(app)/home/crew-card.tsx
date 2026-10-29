// ui-03: one agent in the crew: its creature in its current mood, what it's up to, and how much of today's plate it
// has eaten (today's spend against its daily cap).
import type { Agent } from "@gottaeat/schemas";
import Link from "next/link";
import { Creature } from "@/components/creature/creature";
import { MOOD_EMOJI, MOOD_LABEL, type Mood } from "@/components/creature/mood";
import { MOOD_LINE, plateLine } from "@/lib/kitchen";
import { cn } from "@/lib/utils";

// Whole percent of the cap used, 0 to 100; null without a cap. Integer maths.
export function capUsedPct(spentCents: number, capCents: number | null): number | null {
  if (capCents === null || capCents <= 0) return null;
  return Math.min(100, Math.floor((spentCents * 100) / capCents));
}

export function CrewCard({ agent, mood }: { agent: Agent; mood: Mood }) {
  const spent = agent.today?.spentCents ?? 0;
  const cap = agent.today?.dailyCapCents ?? null;
  const pct = capUsedPct(spent, cap);
  return (
    <Link
      href={`/agents/${encodeURIComponent(agent.id)}`}
      data-testid="crew-card"
      data-mood={mood}
      className="sticker group flex flex-col items-center gap-2 p-4 text-center transition-transform hover:-translate-y-1"
    >
      <Creature
        id={agent.id}
        name={agent.name}
        mood={mood}
        size="md"
        house={agent.kind === "house"}
        className="size-24"
      />
      <div className="w-full min-w-0">
        <p className="font-display truncate text-lg font-semibold">{agent.name}</p>
        <p className="text-sm text-muted-foreground">
          <span aria-hidden>{MOOD_EMOJI[mood]} </span>
          <span className="sr-only">{MOOD_LABEL[mood]}: </span>
          {MOOD_LINE[mood]}
        </p>
      </div>
      <div className="w-full">
        {pct !== null && (
          <div
            role="meter"
            aria-label={`${agent.name}: today's spend against its daily cap`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="h-2.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn("h-full rounded-full", pct >= 90 ? "bg-deny" : pct >= 70 ? "bg-snack" : "bg-allow")}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">{plateLine(spent, cap)}</p>
      </div>
    </Link>
  );
}
