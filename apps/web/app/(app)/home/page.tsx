// ui-02: Today. What an owner opens the app for: what needs them, where their money is, what their agents did, and
// what is happening in the arena. Each section loads on its own, so one failing call doesn't blank the page.
import { AgentList, SpendRequestList, Wallet, WalletActivity } from "@gottaeat/schemas";
import { ArrowRightIcon, BotIcon, CircleCheckIcon, PlusIcon, RadioIcon, ReceiptIcon, WalletIcon } from "lucide-react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { auth } from "@/auth";
import { ActivityList, earnedSince } from "@/components/app/activity-list";
import { EmptyState } from "@/components/app/empty-state";
import { Money } from "@/components/app/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, getMe } from "@/lib/api";
import { PageError } from "../_lib/page-error";
import { ApprovalCard } from "../approvals/approval-card";
import { AgentToday } from "./agent-today";
import { Checklist } from "./checklist";
import { TodayLive } from "./today-live";

export const metadata = { title: "Today · Agents Gotta Eat" };

// How many approvals Today shows before "See all".
const NEEDS_YOU = 2;
const WEEK_MS = 7 * 24 * 3600 * 1000;

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
  const spentToday = agentList.reduce((sum, a) => sum + (a.today?.spentCents ?? 0), 0);
  const earned = "ok" in activity ? earnedSince(activity.ok.items, Date.now() - WEEK_MS) : null;
  const name = firstName(session?.user?.name);
  const funded = "ok" in wallet && wallet.ok.balanceCents + wallet.ok.heldCents > 0;
  // A daily cap only exists once a mandate is confirmed.
  const hasMandate = agentList.some((a) => a.today?.dailyCapCents != null);
  const onboarding = "ok" in agents && "ok" in wallet && (agentList.length === 0 || !hasMandate || !funded);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{name ? `Hi, ${name}` : "Today"}</h1>
        <p className="text-muted-foreground">
          {pending.length > 0
            ? `${pending.length === 1 ? "One spend needs" : `${pending.length} spends need`} you. `
            : "Nothing needs you right now. "}
          {agentList.length > 0 && (
            <>
              Your agents spent <Money cents={spentToday} className="text-foreground" /> today.
            </>
          )}
        </p>
      </div>

      {onboarding && <Checklist hasAgent={agentList.length > 0} hasMandate={hasMandate} funded={funded} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="needs-you" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 id="needs-you" className="text-lg font-semibold">
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
              Spends above your &quot;ask me above&quot; amount, or flagged by the intent check, wait here for you.
            </EmptyState>
          ) : (
            <div className="space-y-4">
              {pending.slice(0, NEEDS_YOU).map((s) => (
                <ApprovalCard key={s.id} spend={s} />
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="wallet-today">
          <h2 id="wallet-today" className="sr-only">
            Wallet
          </h2>
          {"error" in wallet ? (
            <PageError title="Couldn't load your wallet" error={wallet.error} />
          ) : (
            <Link
              href="/wallet"
              className="block overflow-hidden rounded-2xl bg-zinc-950 p-6 text-zinc-100 shadow-lg ring-1 ring-white/5 transition-transform hover:-translate-y-0.5"
            >
              <span className="flex items-center gap-2 text-sm text-zinc-400">
                <WalletIcon className="size-4" aria-hidden /> Available
              </span>
              <Money cents={wallet.ok.balanceCents} className="mt-2 block text-4xl font-semibold tracking-tight" />
              <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-4 text-sm">
                <div>
                  <dt className="text-zinc-400">Held</dt>
                  <dd>
                    <Money cents={wallet.ok.heldCents} className="text-amber-300" />
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-400">Earned this week</dt>
                  <dd>{earned === null ? "—" : <Money cents={earned} className="text-emerald-300" />}</dd>
                </div>
              </dl>
            </Link>
          )}
        </section>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BotIcon className="size-4 text-primary" aria-hidden /> Your agents today
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/agents">
                <PlusIcon aria-hidden /> Add
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {"error" in agents ? (
              <PageError title="Couldn't load your agents" error={agents.error} />
            ) : agentList.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No agents yet. Register one and give it a wallet with rules.
              </p>
            ) : (
              <div className="grid gap-1 sm:grid-cols-2">
                {agentList.map((a) => (
                  <AgentToday key={a.id} agent={a} />
                ))}
              </div>
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ReceiptIcon className="size-4 text-primary" aria-hidden /> Recent activity
          </CardTitle>
          <Link href="/wallet" className="text-sm font-medium text-primary">
            All activity
          </Link>
        </CardHeader>
        <CardContent>
          {"error" in activity ? (
            <PageError title="Couldn't load activity" error={activity.error} />
          ) : (
            <ActivityList items={activity.ok.items} empty="No money has moved yet. Top up your wallet to start." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
