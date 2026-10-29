// ui-04: one agent in the Agents kitchen: its creature in its mood, what it's up to, today's plate, its record and
// its key, with the rotate and revoke menu.
import type { Agent } from "@gottaeat/schemas";
import { KeyRoundIcon, StarIcon } from "lucide-react";
import Link from "next/link";
import { PlateMeter } from "@/components/app/plate-meter";
import { VerdictBadge } from "@/components/app/verdict-badge";
import { Creature } from "@/components/creature/creature";
import { MOOD_EMOJI, MOOD_LABEL, type Mood } from "@/components/creature/mood";
import { unrated } from "@/lib/crew";
import { MOOD_LINE } from "@/lib/kitchen";
import { formatTenths } from "@/lib/money";
import { AgentActions } from "./agent-actions";

export function AgentCard({ agent, mood }: { agent: Agent; mood: Mood }) {
  const href = `/agents/${encodeURIComponent(agent.id)}`;
  return (
    <article
      data-testid="agent-card"
      data-mood={mood}
      aria-label={agent.name}
      className="sticker relative flex flex-col items-center gap-3 p-5 text-center"
    >
      <div className="absolute top-2 right-2">
        <AgentActions agent={{ id: agent.id, name: agent.name, apiKeyPrefix: agent.apiKeyPrefix }} />
      </div>
      <Link href={href} tabIndex={-1} aria-hidden className="transition-transform hover:-translate-y-1">
        <Creature
          id={agent.id}
          name={agent.name}
          mood={mood}
          size="md"
          house={agent.kind === "house"}
          className="size-24"
        />
      </Link>
      <div className="w-full min-w-0">
        <h2 className="font-display truncate text-lg font-semibold">
          <Link href={href} className="hover:underline">
            {agent.name}
          </Link>
        </h2>
        <p className="text-sm text-muted-foreground">
          <span aria-hidden>{MOOD_EMOJI[mood]} </span>
          <span className="sr-only">{MOOD_LABEL[mood]}: </span>
          {MOOD_LINE[mood]}
        </p>
      </div>
      <PlateMeter name={agent.name} spentCents={agent.today?.spentCents ?? 0} capCents={agent.today?.dailyCapCents ?? null} />
      <dl className="grid w-full grid-cols-2 gap-2 border-t border-border pt-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Rating</dt>
          <dd className="inline-flex items-center gap-1 tabular-nums">
            {unrated(agent) ? (
              "New"
            ) : (
              <>
                <StarIcon className="size-3.5 fill-snack text-snack" aria-hidden />
                {formatTenths(agent.rating)}
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Jobs done</dt>
          <dd className="tabular-nums">{agent.completedJobs}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap justify-center gap-1.5">
        {agent.apiKeyPrefix === null ? (
          <VerdictBadge tone="deny">key revoked</VerdictBadge>
        ) : (
          <VerdictBadge tone="neutral" className="font-mono">
            <KeyRoundIcon className="size-3" aria-hidden />
            {agent.apiKeyPrefix}…
          </VerdictBadge>
        )}
        {agent.kind === "house" && <VerdictBadge tone="paypal">house</VerdictBadge>}
        {agent.status !== "active" && <VerdictBadge tone="flag">{agent.status}</VerdictBadge>}
      </div>
    </article>
  );
}
