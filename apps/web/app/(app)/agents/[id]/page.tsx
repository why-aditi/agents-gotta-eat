// Agent detail: the mandate editor (with version history) and the spend timeline.
import { AgentList, MandateList, SpendRequestList } from "@gottaeat/schemas";
import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, apiFetch } from "@/lib/api";
import { formatTenths } from "@/lib/money";
import { PageError } from "../../_lib/page-error";
import { activeVersion } from "./describe-rules";
import { MandateForm } from "./mandate-form";
import { MandateVersions } from "./mandate-versions";
import { SpendTimeline } from "./spend-timeline";

export const metadata = { title: "Agent · Agents Gotta Eat" };

export default async function AgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const base = `/v1/agents/${encodeURIComponent(id)}`;

  let loaded;
  try {
    const [{ agents }, { mandates }, { spendRequests }] = await Promise.all([
      apiFetch(AgentList, "/v1/agents"),
      apiFetch(MandateList, `${base}/mandates`),
      apiFetch(SpendRequestList, `${base}/spend-requests`),
    ]);
    loaded = { agent: agents.find((a) => a.id === id), mandates, spendRequests };
  } catch (err) {
    // Next's own control-flow errors (dynamic rendering, redirects) must propagate.
    unstable_rethrow(err);
    // 404 for an unknown agent or someone else's, so ids don't leak.
    if (err instanceof ApiError && err.status === 404) notFound();
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Agent</h1>
        <PageError title="Couldn't load this agent" error={err} />
      </div>
    );
  }
  const { agent, mandates, spendRequests } = loaded;
  if (!agent) notFound();

  const active = activeVersion(mandates);
  const prefill = mandates.find((m) => m.version === active) ?? mandates[0] ?? null;
  const defaultTab = tab === "timeline" ? "timeline" : "mandate";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/agents" className="text-sm text-muted-foreground hover:underline">
          ← Agents
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight break-all">{agent.name}</h1>
          <Badge variant="outline">{agent.kind}</Badge>
          <Badge variant={agent.status === "active" ? "secondary" : "destructive"}>{agent.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-mono">{agent.id}</span> · Rating {formatTenths(agent.rating)} ·{" "}
          {active === null ? "No active mandate" : `Mandate v${active} active`}
        </p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="mandate">Mandate</TabsTrigger>
          <TabsTrigger value="timeline">Spend timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="mandate" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <Card>
              <CardHeader>
                <CardTitle>Mandate</CardTitle>
                <CardDescription>
                  {prefill
                    ? `Prefilled from version ${prefill.version}. Saving creates a new version; confirm it to make it active.`
                    : "Tell this agent what it may spend on. Saving creates version 1; confirm it to make it active."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Remount when the active version changes so the fields show it; saving alone keeps the review card. */}
                <MandateForm key={active ?? "none"} agentId={agent.id} initial={prefill} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Versions</CardTitle>
                <CardDescription>The highest confirmed version is active.</CardDescription>
              </CardHeader>
              <CardContent>
                <MandateVersions agentId={agent.id} mandates={mandates} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Spend timeline</CardTitle>
              <CardDescription>Newest first. Open a row to see how each gate decided.</CardDescription>
            </CardHeader>
            <CardContent>
              <SpendTimeline spendRequests={spendRequests} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
