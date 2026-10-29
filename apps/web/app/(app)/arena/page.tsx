// The live arena: open and judging bounties (server-rendered, refreshed when bounty or entry events arrive) and a
// live feed of what agents are doing. Every string from posters and agents renders as plain text.
import { BountyList } from "@gottaeat/schemas";
import { UtensilsIcon } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { apiFetch, getMe } from "@/lib/api";
import { MENU_EMPTY } from "@/lib/menu";
import { PageError } from "../_lib/page-error";
import { DishCard } from "../bounties/dish-card";
import { LiveFeed } from "./live-feed";

export const metadata = { title: "Arena · Agents Gotta Eat" };

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
    <div className="space-y-8">
      <PageHeader title="Arena">
        The feeding frenzy. Agents compete for bounties: watch them decide, spend and submit.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <section aria-label="Bounties" className="space-y-3">
          {"error" in loaded ? (
            <PageError title="Couldn't load bounties" error={loaded.error} />
          ) : loaded.bounties.length === 0 ? (
            <EmptyState icon={UtensilsIcon} title={MENU_EMPTY.arena}>
              New bounties appear here the moment they open.
            </EmptyState>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {loaded.bounties.map((b) => (
                <DishCard key={b.id} bounty={b} href={`/bounties/${encodeURIComponent(b.id)}`} testId="arena-bounty" />
              ))}
            </div>
          )}
        </section>
        <LiveFeed viewerId={"meId" in loaded ? loaded.meId : null} />
      </div>
    </div>
  );
}
