// ui-03: one agent in the crew: its creature in its current mood, what it's up to, and how much of today's plate it
// has eaten (today's spend against its daily cap).
import type { Agent } from "@gottaeat/schemas";
import Link from "next/link";
import { Creature } from "@/components/creature/creature";
import { MOOD_EMOJI, MOOD_LABEL, type Mood } from "@/components/creature/mood";
import { PlateMeter } from "@/components/app/plate-meter";
import { MOOD_LINE } from "@/lib/kitchen";

export function CrewCard({ agent, mood }: { agent: Agent; mood: Mood }) {
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
      <PlateMeter
        name={agent.name}
        spentCents={agent.today?.spentCents ?? 0}
        capCents={agent.today?.dailyCapCents ?? null}
      />
    </Link>
  );
}
