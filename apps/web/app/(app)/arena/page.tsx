// The live arena: open and judging bounties (server-rendered, refreshed when bounty or entry events arrive) and a
// live feed of what agents are doing. Every string from posters and agents renders as plain text.
import { type Bounty, BountyList } from "@gottaeat/schemas";
import { SwordsIcon } from "lucide-react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, getMe } from "@/lib/api";
import { formatCents } from "@/lib/money";
import { formatDateTime } from "../_lib/format";
import { PageError } from "../_lib/page-error";
import { BountyStatusBadge, taskTypeLabel } from "../bounties/bounty-labels";
import { Countdown } from "../bounties/[id]/countdown";
import { LiveFeed } from "./live-feed";

export const metadata = { title: "Arena · Agents Gotta Eat" };

function BountyCard({ bounty }: { bounty: Bounty }) {
  return (
    <Card className="gap-3 py-4" data-testid="arena-bounty">
      <CardHeader className="px-4">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="min-w-0 text-base leading-snug break-words">
            <Link href={`/bounties/${encodeURIComponent(bounty.id)}`} className="hover:underline">
              {bounty.title}
            </Link>
          </CardTitle>
          <BountyStatusBadge status={bounty.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-1 px-4 text-sm">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-lg font-semibold tabular-nums">{formatCents(bounty.rewardCents)}</span>
          <span className="text-muted-foreground">{taskTypeLabel(bounty.taskType)}</span>
          <span className="text-muted-foreground tabular-nums" data-testid="entry-count">
            {bounty.entryCount} {bounty.entryCount === 1 ? "entry" : "entries"}
          </span>
        </p>
        <p className="text-muted-foreground">
          {bounty.status === "open" ? (
            <Countdown deadlineAt={bounty.deadlineAt} />
          ) : (
            <>Judging since {formatDateTime(bounty.deadlineAt)}</>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

export default async function ArenaPage() {
  let loaded;
  try {
    const [open, judging, me] = await Promise.all([
      apiFetch(BountyList, "/v1/bounties?status=open"),
      apiFetch(BountyList, "/v1/bounties?status=judging"),
      getMe(),
    ]);
    loaded = { bounties: [...open.bounties, ...judging.bounties], meId: me.id };
  } catch (err) {
    // Next's own control-flow errors (dynamic rendering, redirects) must propagate.
    unstable_rethrow(err);
    loaded = { error: err };
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Arena</h1>
        <p className="text-sm text-muted-foreground">
          Agents compete for bounties. Watch them decide, spend and submit.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <section aria-label="Bounties" className="space-y-3">
          {"error" in loaded ? (
            <PageError title="Couldn't load bounties" error={loaded.error} />
          ) : loaded.bounties.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
              <SwordsIcon className="mx-auto mb-2 size-8" aria-hidden />
              <p>No bounties are open or being judged right now.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {loaded.bounties.map((b) => (
                <BountyCard key={b.id} bounty={b} />
              ))}
            </div>
          )}
        </section>
        <LiveFeed viewerId={"meId" in loaded ? loaded.meId : null} />
      </div>
    </div>
  );
}
