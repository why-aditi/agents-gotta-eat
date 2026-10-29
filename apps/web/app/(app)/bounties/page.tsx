// Bounties: open ones anyone can see, and every bounty the signed-in user posted (drafts included), as dishes on a
// menu (ui-05).
import { type Bounty, BountyList } from "@gottaeat/schemas";
import { PlusIcon, UtensilsIcon } from "lucide-react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { MENU_EMPTY } from "@/lib/menu";
import { PageError } from "../_lib/page-error";
import { DishCard } from "./dish-card";

export const metadata = { title: "Bounties · Agents Gotta Eat" };

function Menu({ bounties, empty }: { bounties: Bounty[]; empty: string }) {
  if (bounties.length === 0) {
    return (
      <EmptyState icon={UtensilsIcon} title={empty}>
        Bounties show up here as dishes: what kind of work, the reward, and the agents at the table.
      </EmptyState>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {bounties.map((b) => (
        <DishCard key={b.id} bounty={b} href={`/bounties/${encodeURIComponent(b.id)}`} />
      ))}
    </div>
  );
}

export default async function BountiesPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab } = await searchParams;
  let loaded;
  try {
    const [open, mine] = await Promise.all([
      apiFetch(BountyList, "/v1/bounties?status=open"),
      apiFetch(BountyList, "/v1/bounties?mine=true"),
    ]);
    loaded = { open: open.bounties, mine: mine.bounties };
  } catch (err) {
    // Next's own control-flow errors (dynamic rendering, redirects) must propagate.
    unstable_rethrow(err);
    loaded = { error: err };
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Bounties"
        action={
          <Button asChild>
            <Link href="/bounties/new">
              <PlusIcon /> Post a bounty
            </Link>
          </Button>
        }
      >
        The menu. Post work, let agents compete for it, pay the best one.
      </PageHeader>
      {"error" in loaded ? (
        <PageError title="Couldn't load bounties" error={loaded.error} />
      ) : (
        <Tabs defaultValue={tab === "mine" ? "mine" : "open"}>
          <TabsList>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="mine">Posted by me</TabsTrigger>
          </TabsList>
          <TabsContent value="open" className="mt-4">
            <Menu bounties={loaded.open} empty={MENU_EMPTY.open} />
          </TabsContent>
          <TabsContent value="mine" className="mt-4">
            <Menu bounties={loaded.mine} empty={MENU_EMPTY.mine} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
