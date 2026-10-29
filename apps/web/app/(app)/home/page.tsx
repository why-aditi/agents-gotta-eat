// ui-02: Today. What an owner opens the app for: what needs them, where their money is, what their agents did, and
// what is happening in the arena. Each section loads on its own, so one failing call doesn't blank the page.
// ui-03: the kitchen. The crew of creatures leads, each in a mood drawn from real state.
import { AgentList, SpendRequestList, Wallet, WalletActivity } from "@gottaeat/schemas";
import { ArrowRightIcon, CircleCheckIcon, PlusIcon, RadioIcon, UtensilsIcon } from "lucide-react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { auth } from "@/auth";
import { ActivityList, earnedSince } from "@/components/app/activity-list";
import { EmptyState } from "@/components/app/empty-state";
import { FeastConfetti } from "@/components/app/feast-confetti";
import { moodFor } from "@/components/creature/mood";
import { Money } from "@/components/app/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, getMe } from "@/lib/api";
import { SUBTITLE } from "@/lib/kitchen";
import { PageError } from "../_lib/page-error";
import { ApprovalCard } from "../approvals/approval-card";
import { CrewCard } from "./crew-card";
import { Greeting } from "./greeting";
import { Checklist } from "./checklist";
import { TodayLive } from "./today-live";

export const metadata = { title: "Today · Agents Gotta Eat" };

// How many approvals Today shows before "See all".
const NEEDS_YOU = 2;
const DAY_MS = 24 * 3600 * 1000;
const WEEK_MS = 7 * DAY_MS;

async function settle<T>(p: Promise<T>): Promise<{ ok: T } | { error: unknown }> {
  try {
    return { ok: await p };
  } catch (err) {
    // Next's own control-flow errors (dynamic rendering, redirects) must propagate.
    unstable_rethrow(err);
    return { error: err };
  }
}

function firstName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}

export default async function TodayPage() {
  const [session, approvals, wallet, agents, activity, me] = await Promise.all([
    auth(),
    settle(apiFetch(SpendRequestList, "/v1/approvals?status=pending")),
    settle(apiFetch(Wallet, "/v1/wallet")),
    settle(apiFetch(AgentList, "/v1/agents")),
    settle(apiFetch(WalletActivity, "/v1/wallet/activity?limit=8")),
    settle(getMe()),
  ]);
  const pending = "ok" in approvals ? approvals.ok.spendRequests : [];
  const agentList = "ok" in agents ? agents.ok.agents : [];
  const items = "ok" in activity ? activity.ok.items : [];
  const now = Date.now();
  const spentToday = agentList.reduce((sum, a) => sum + (a.today?.spentCents ?? 0), 0);
  const earned = "ok" in activity ? earnedSince(items, now - WEEK_MS) : null;
  const name = firstName(session?.user?.name);
  const funded = "ok" in wallet && wallet.ok.balanceCents + wallet.ok.heldCents > 0;
  // A daily cap only exists once a mandate is confirmed.
  const hasMandate = agentList.some((a) => a.today?.dailyCapCents != null);
  const onboarding = "ok" in agents && "ok" in wallet && (agentList.length === 0 || !hasMandate || !funded);
  const latestWin = items.find((i) => i.kind === "earning") ?? null;
  const crew = agentList.map((a) => ({
    agent: a,
    mood: moodFor({
      spentCents: a.today?.spentCents ?? 0,
      capCents: a.today?.dailyCapCents ?? null,
      pendingApprovals: pending.filter((s) => s.agentId === a.id).length,
      active: a.status === "active",
      hasMandate: a.today?.dailyCapCents != null,
      recentWin: items.some(
        (i) => i.kind === "earning" && i.agentId === a.id && Date.parse(i.createdAt) >= now - DAY_MS,
      ),
    }),
  }));

  return (
    <div className="space-y-10">
      <FeastConfetti winId={latestWin?.id ?? null} />
      <div className="space-y-2">
        <Greeting name={name} />
        <p className="text-lg text-muted-foreground">
          {pending.length > 0
            ? `${pending.length === 1 ? "One agent is" : `${pending.length} agents are`} begging. `
            : "Nobody's begging right now. "}
          {agentList.length > 0 && (
            <>
              Your crew ate <Money cents={spentToday} className="text-foreground" /> today.
            </>
          )}
        </p>
        <p className="text-sm text-muted-foreground">{SUBTITLE.today}</p>
      </div>

      {onboarding && <Checklist hasAgent={agentList.length > 0} hasMandate={hasMandate} funded={funded} />}

      <section aria-labelledby="crew" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="crew" className="font-display text-2xl font-semibold">
            The crew
          </h2>
          <Link href="/agents" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
            <PlusIcon className="size-4" aria-hidden /> Adopt an agent
          </Link>
        </div>
        {"error" in agents ? (
          <PageError title="Couldn't load your agents" error={agents.error} />
        ) : agentList.length === 0 ? (
          <EmptyState icon={UtensilsIcon} title="The kitchen is empty">
            Adopt your first agent: it gets its own API key, a diet you write in plain English, and a seat at the table.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {crew.map(({ agent, mood }) => (
              <CrewCard key={agent.id} agent={agent} mood={mood} />
            ))}
          </div>
        )}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="needs-you" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 id="needs-you" className="font-display text-2xl font-semibold">
              Needs you
            </h2>
            {pending.length > NEEDS_YOU && (
              <Link href="/approvals" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                See all {pending.length} <ArrowRightIcon className="size-4" aria-hidden />
              </Link>
            )}
          </div>
          {"error" in approvals ? (
            <PageError title="Couldn't load approvals" error={approvals.error} />
          ) : pending.length === 0 ? (
            <EmptyState icon={CircleCheckIcon} title="All clear">
              Everyone&apos;s fed. Spends above your &quot;ask me above&quot; amount, or flagged by the intent check,
              beg here.
            </EmptyState>
          ) : (
            <div className="space-y-4">
              {pending.slice(0, NEEDS_YOU).map((s) => (
                <ApprovalCard key={s.id} spend={s} />
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="wallet-today" className="space-y-4">
          <h2 id="wallet-today" className="font-display text-2xl font-semibold">
            <span aria-hidden>🥫 </span>The pantry
          </h2>
          {"error" in wallet ? (
            <PageError title="Couldn't load your wallet" error={wallet.error} />
          ) : (
            <Link
              href="/wallet"
              aria-label="Wallet"
              className="sticker block bg-snack-soft p-6 transition-transform hover:-translate-y-1"
            >
              <span className="text-sm text-muted-foreground">Available to eat</span>
              <Money cents={wallet.ok.balanceCents} className="font-display mt-1 block text-5xl font-semibold" />
              <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-outline/20 pt-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">On hold</dt>
                  <dd>
                    <Money cents={wallet.ok.heldCents} className="text-flag" />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Earned this week</dt>
                  <dd>{earned === null ? "—" : <Money cents={earned} className="text-allow" />}</dd>
                </div>
              </dl>
            </Link>
          )}
        </section>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span aria-hidden>🍽️</span> Recent meals
            </CardTitle>
            <Link href="/wallet" className="text-sm font-medium text-primary">
              All activity
            </Link>
          </CardHeader>
          <CardContent>
            {"error" in activity ? (
              <PageError title="Couldn't load activity" error={activity.error} />
            ) : (
              <ActivityList items={items} empty="Nothing eaten yet. Stock the pantry to get your crew going." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RadioIcon className="size-4 text-deny" aria-hidden /> Live in the arena
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TodayLive viewerId={"ok" in me ? me.ok.id : null} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
