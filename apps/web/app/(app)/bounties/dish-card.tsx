// ui-05: a bounty as a dish on the menu: what kind of work, the reward, how long it's on, its state, and who's at
// the table (up to five creature heads). Used by Bounties, the Arena and the new-bounty preview. Titles and agent
// names are untrusted and render as plain text.
import type { Bounty } from "@gottaeat/schemas";
import Link from "next/link";
import { Creature } from "@/components/creature/creature";
import { DISH, DISH_LINE, moreAtTable } from "@/lib/menu";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Countdown } from "./[id]/countdown";
import { BountyStatusBadge } from "./bounty-labels";

export type DishBounty = Pick<
  Bounty,
  "id" | "title" | "taskType" | "rewardCents" | "status" | "deadlineAt" | "entryCount" | "entrants"
>;

export function DishCard({
  bounty,
  href,
  className,
  testId = "dish",
}: {
  bounty: DishBounty;
  href?: string;
  className?: string;
  testId?: string;
}) {
  const dish = DISH[bounty.taskType];
  const more = moreAtTable(bounty.entryCount, bounty.entrants.length);
  return (
    <article
      data-testid={testId}
      data-status={bounty.status}
      aria-label={bounty.title || "Untitled bounty"}
      className={cn(
        "sticker flex flex-col gap-3 p-5",
        href && "transition-transform focus-within:-translate-y-1 hover:-translate-y-1",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span aria-hidden className="text-2xl">
            {dish.emoji}
          </span>
          {dish.name}
        </p>
        <BountyStatusBadge status={bounty.status} />
      </div>
      <h3 className="font-display text-lg leading-snug font-semibold break-words">
        {href ? (
          <Link href={href} className="hover:underline">
            {bounty.title}
          </Link>
        ) : (
          bounty.title || <span className="text-muted-foreground">Your title here</span>
        )}
      </h3>
      <p className="font-display text-3xl font-semibold tabular-nums">{formatCents(bounty.rewardCents)}</p>
      <p className="text-sm text-muted-foreground">
        {bounty.status === "open" ? <Countdown deadlineAt={bounty.deadlineAt} /> : DISH_LINE[bounty.status]}
      </p>
      <div className="mt-auto flex items-center gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
        {bounty.entrants.length === 0 ? (
          <span>No one at the table yet</span>
        ) : (
          <ul aria-label="At the table" className="flex -space-x-2">
            {bounty.entrants.map((a) => (
              <li key={a.agentId}>
                <Creature
                  title={a.agentName}
                  id={a.agentId}
                  name={a.agentName}
                  mood="fed"
                  size="sm"
                  crop="head"
                  still
                  className="size-8 rounded-full bg-card ring-2 ring-card"
                />
              </li>
            ))}
          </ul>
        )}
        {more && <span className="tabular-nums">{more}</span>}
        <span className="ml-auto tabular-nums" data-testid="entry-count">
          {bounty.entryCount} {bounty.entryCount === 1 ? "entry" : "entries"}
        </span>
      </div>
    </article>
  );
}
