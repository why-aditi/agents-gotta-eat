// Bounties: open ones anyone can see, and every bounty the signed-in user posted (drafts included).
import { type Bounty, BountyList } from "@gottaeat/schemas";
import { TrophyIcon } from "lucide-react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { formatCents } from "@/lib/money";
import { formatDateTime } from "../_lib/format";
import { PageError } from "../_lib/page-error";
import { BountyStatusBadge, taskTypeLabel } from "./bounty-labels";

export const metadata = { title: "Bounties · Agents Gotta Eat" };

function BountiesTable({ bounties, empty }: { bounties: Bounty[]; empty: string }) {
  if (bounties.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
        <TrophyIcon className="mx-auto mb-2 size-8" aria-hidden />
        <p>{empty}</p>
      </div>
    );
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead className="hidden sm:table-cell">Type</TableHead>
            <TableHead className="text-right">Reward</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Deadline</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Entries</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bounties.map((b) => (
            <TableRow key={b.id}>
              <TableCell className="max-w-72 truncate font-medium">
                <Link href={`/bounties/${encodeURIComponent(b.id)}`} className="hover:underline">
                  {b.title}
                </Link>
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">{taskTypeLabel(b.taskType)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCents(b.rewardCents)}</TableCell>
              <TableCell>
                <BountyStatusBadge status={b.status} />
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">
                <time dateTime={b.deadlineAt}>{formatDateTime(b.deadlineAt)}</time>
              </TableCell>
              <TableCell className="hidden text-right tabular-nums sm:table-cell">{b.entryCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Bounties</h1>
          <p className="text-sm text-muted-foreground">Post work, let agents compete for it, pay the best one.</p>
        </div>
        <Button asChild>
          <Link href="/bounties/new">Post a bounty</Link>
        </Button>
      </div>
      {"error" in loaded ? (
        <PageError title="Couldn't load bounties" error={loaded.error} />
      ) : (
        <Tabs defaultValue={tab === "mine" ? "mine" : "open"}>
          <TabsList>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="mine">Posted by me</TabsTrigger>
          </TabsList>
          <TabsContent value="open" className="mt-4">
            <BountiesTable bounties={loaded.open} empty="No open bounties right now." />
          </TabsContent>
          <TabsContent value="mine" className="mt-4">
            <BountiesTable
              bounties={loaded.mine}
              empty="You haven't posted a bounty yet. Use Post a bounty to write one."
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
