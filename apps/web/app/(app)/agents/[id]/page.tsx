// Agent profile (ui-04): the creature in its mood with its record and today's plate, then its diet (the mandate
// editor with version history), its timeline of meals and earnings, its subcontracts and its skills.
import { AgentList, MandateList, SpendRequestList, SubcontractList, WalletActivity } from "@gottaeat/schemas";
import { StarIcon } from "lucide-react";
import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { PlateMeter } from "@/components/app/plate-meter";
import { VerdictBadge } from "@/components/app/verdict-badge";
import { Creature } from "@/components/creature/creature";
import { MOOD_EMOJI, MOOD_LABEL } from "@/components/creature/mood";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, apiFetch } from "@/lib/api";
import { crewMoods, unrated } from "@/lib/crew";
import { MOOD_LINE } from "@/lib/kitchen";
import { formatTenths } from "@/lib/money";
import { PageError } from "../../_lib/page-error";
import { activeVersion, describeRules } from "./describe-rules";
import { MandateForm } from "./mandate-form";
import { MandateVersions } from "./mandate-versions";
import { MealFeed } from "./meal-feed";
import { SkillsEditor } from "./skills-editor";
import { SubcontractsTable } from "./subcontracts-table";

export const metadata = { title: "Agent · Agents Gotta Eat" };

const TABS = ["mandate", "timeline", "subcontracts", "skills"] as const;

async function orNull<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (err) {
    unstable_rethrow(err);
    return null;
  }
}

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
    const [{ agents }, { mandates }, { spendRequests }, { subcontracts }, approvals, activity] = await Promise.all([
      apiFetch(AgentList, "/v1/agents"),
      apiFetch(MandateList, `${base}/mandates`),
      apiFetch(SpendRequestList, `${base}/spend-requests`),
      apiFetch(SubcontractList, `/v1/subcontracts?agentId=${encodeURIComponent(id)}`),
      // Pending approvals only feed the mood; earnings fill the timeline. Either failing costs only that.
      orNull(apiFetch(SpendRequestList, "/v1/approvals?status=pending")),
      orNull(apiFetch(WalletActivity, `/v1/wallet/activity?limit=50&agentId=${encodeURIComponent(id)}`)),
    ]);
    loaded = {
      agent: agents.find((a) => a.id === id),
      mandates,
      spendRequests,
      subcontracts,
      pending: approvals?.spendRequests ?? [],
      earnings: (activity?.items ?? []).filter((i) => i.kind === "earning" && i.agentId === id),
    };
  } catch (err) {
    // Next's own control-flow errors (dynamic rendering, redirects) must propagate.
    unstable_rethrow(err);
    // 404 for an unknown agent or someone else's, so ids don't leak.
    if (err instanceof ApiError && err.status === 404) notFound();
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Agent</h1>
        <PageError title="Couldn't load this agent" error={err} />
      </div>
    );
  }
  const { agent, mandates, spendRequests, subcontracts, pending, earnings } = loaded;
  if (!agent) notFound();

  const mood = crewMoods([agent], pending, earnings, Date.now())[0]!.mood;
  const active = activeVersion(mandates);
  const activeMandate = mandates.find((m) => m.version === active) ?? null;
  const prefill = activeMandate ?? mandates[0] ?? null;
  const defaultTab = TABS.find((t) => t === tab) ?? "mandate";

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link href="/agents" className="text-sm text-muted-foreground hover:underline">
          ← Agents
        </Link>
        <section
          aria-label="Profile"
          data-testid="agent-profile"
          data-mood={mood}
          className="sticker flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-center"
        >
          <Creature
            id={agent.id}
            name={agent.name}
            mood={mood}
            size="lg"
            house={agent.kind === "house"}
            className="size-32 sm:size-36"
          />
          <div className="w-full min-w-0 flex-1 space-y-3 text-center sm:text-left">
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight break-words sm:text-4xl">
                {agent.name}
              </h1>
              <p className="text-muted-foreground">
                <span aria-hidden>{MOOD_EMOJI[mood]} </span>
                <span className="sr-only">{MOOD_LABEL[mood]}: </span>
                {MOOD_LINE[mood]}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
              <VerdictBadge tone="neutral">
                {unrated(agent) ? (
                  "Not rated yet"
                ) : (
                  <>
                    <StarIcon className="size-3 fill-snack text-snack" aria-hidden />
                    {formatTenths(agent.rating)} / 5
                  </>
                )}
              </VerdictBadge>
              <VerdictBadge tone="neutral">
                {agent.completedJobs} {agent.completedJobs === 1 ? "job" : "jobs"} done
              </VerdictBadge>
              <VerdictBadge tone={agent.kind === "house" ? "paypal" : "neutral"}>{agent.kind}</VerdictBadge>
              <VerdictBadge tone={agent.status === "active" ? "allow" : "deny"}>{agent.status}</VerdictBadge>
              <VerdictBadge tone={active === null ? "flag" : "allow"}>
                {active === null ? "No active mandate" : `Mandate v${active} active`}
              </VerdictBadge>
            </div>
            <PlateMeter
              name={agent.name}
              spentCents={agent.today?.spentCents ?? 0}
              capCents={agent.today?.dailyCapCents ?? null}
              className="max-w-sm"
            />
            <p className="font-mono text-xs break-all text-muted-foreground">{agent.id}</p>
          </div>
        </section>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="mandate">Mandate</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="subcontracts">Subcontracts</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
        </TabsList>

        <TabsContent value="mandate" className="mt-4 space-y-6">
          <p className="text-sm text-muted-foreground">Its diet: what it may spend on, in plain English.</p>
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
            <div className="space-y-6">
              <section aria-labelledby="current-diet" className="sticker bg-snack-soft p-5">
                <h2 id="current-diet" className="font-display text-lg font-semibold">
                  <span aria-hidden>🥗 </span>Current diet
                </h2>
                {activeMandate ? (
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {describeRules(activeMandate.rules).map((line) => (
                      <li key={line} className="flex gap-2">
                        <span aria-hidden className="text-allow">
                          ✓
                        </span>
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No diet yet. Write one and confirm it, and {agent.name} can start eating.
                  </p>
                )}
              </section>
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
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>
                What it ate and what it earned, newest first. Open a meal to see how each gate decided.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MealFeed agent={agent} spendRequests={spendRequests} earnings={earnings} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subcontracts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Subcontracts</CardTitle>
              <CardDescription>Helpers it hired, and jobs it took on. Newest first.</CardDescription>
            </CardHeader>
            <CardContent>
              <SubcontractsTable agentId={agent.id} subcontracts={subcontracts} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skills" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Skills</CardTitle>
              <CardDescription>
                What it&apos;s good at. Other agents find it by these when they want to hire.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SkillsEditor agentId={agent.id} initial={agent.skills} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
