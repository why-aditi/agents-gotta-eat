// One bounty: header with status and countdown, the public spec, entries, the poster's actions (fund, cancel,
// pick, dispute) and results once settled or voided. While open or judging it re-renders on this bounty's live events, and
// every 30 seconds as a fallback.
// Bounty text and submissions are untrusted and render as plain text only.
import {
  type Bounty,
  Bounty as BountySchema,
  type BountyResults,
  BountyResults as BountyResultsSchema,
  type Entry,
  EntryList,
  SubmissionContent,
} from "@gottaeat/schemas";
import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { VerdictBadge } from "@/components/app/verdict-badge";
import { Creature } from "@/components/creature/creature";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LiveRefresh } from "@/components/live-refresh";
import { ApiError, apiFetch, getMe } from "@/lib/api";
import { DISH } from "@/lib/menu";
import { formatCents } from "@/lib/money";
import { formatDateTime } from "../../_lib/format";
import { PageError } from "../../_lib/page-error";
import { BountyStatusBadge, taskTypeLabel } from "../bounty-labels";
import { BountyActions } from "./bounty-actions";
import { Countdown } from "./countdown";
import { DisputeDialog } from "./dispute-dialog";
import { DisputeStatus, type DisputeViewer } from "./dispute-status";
import { FundCard } from "./fund-card";
import { type PickableSubmission, PickCard } from "./pick-card";

export const metadata = { title: "Bounty · Agents Gotta Eat" };

type Results = BountyResults["entries"][number];

function PlainText({ children, mono }: { children: string; mono?: boolean }) {
  return (
    <p
      className={`max-h-96 overflow-auto rounded-xl bg-muted p-3 text-sm break-words whitespace-pre-wrap ${mono ? "font-mono text-xs" : ""}`}
    >
      {children}
    </p>
  );
}

function SpecField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

const str = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v ?? null, null, 2));

function PublicSpec({ bounty }: { bounty: Bounty }) {
  const spec = bounty.spec;
  if (bounty.taskType === "creative_writing") {
    return (
      <>
        <SpecField label="Brief">
          <PlainText>{str(spec.brief)}</PlainText>
        </SpecField>
        <SpecField label="Rubric">
          <PlainText>{str(spec.rubric)}</PlainText>
        </SpecField>
      </>
    );
  }
  if (bounty.taskType === "extract_data") {
    const sources = Array.isArray(spec.sources) ? (spec.sources as { name?: unknown; content?: unknown }[]) : [];
    return (
      <>
        <SpecField label="Instructions">
          <PlainText>{str(spec.instructions)}</PlainText>
        </SpecField>
        <SpecField label="Output JSON Schema">
          <PlainText mono>{JSON.stringify(spec.schema ?? null, null, 2)}</PlainText>
        </SpecField>
        {sources.map((s, i) => (
          <SpecField key={i} label={`Source: ${str(s.name)}`}>
            <PlainText mono>{str(s.content)}</PlainText>
          </SpecField>
        ))}
      </>
    );
  }
  return <PlainText mono>{JSON.stringify(spec, null, 2)}</PlainText>;
}

// ui-05: the agents at the table, each with its creature and name.
function TableSeats({ entries, results }: { entries: Entry[]; results: Map<string, Results> | null }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">No one at the table yet.</p>
    );
  }
  return (
    <ul className="divide-y">
      {entries.map((e) => {
        const r = results?.get(e.id);
        return (
          <li key={e.id} data-testid="entry-row" className="flex items-center gap-3 py-3">
            <Creature id={e.agentId} name={e.agentName} mood="fed" size="sm" crop="head" still className="size-10" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{e.agentName}</p>
              <p className="text-xs text-muted-foreground">Entered {formatDateTime(e.createdAt)}</p>
            </div>
            {e.submissionId ? (
              <VerdictBadge tone="allow">submitted</VerdictBadge>
            ) : (
              <VerdictBadge tone="neutral">{e.status === "submitted" ? "submitted" : `no (${e.status})`}</VerdictBadge>
            )}
            <span className="w-12 text-right tabular-nums" aria-label="Score">
              {r?.score ?? "—"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function payoutText(bounty: Bounty, results: BountyResults, windowOpen: boolean): string {
  const reward = formatCents(bounty.rewardCents);
  if (results.dispute?.status === "overturned") return `${reward} refunded to the poster`;
  const held = results.dispute?.status === "open" || (windowOpen && results.disputeUntil !== null && !results.dispute);
  return held ? `${reward} to the owner's wallet once the result is final` : `${reward} to the owner's wallet`;
}

function ResultsCard({
  bounty,
  results,
  viewer,
  windowOpen,
}: {
  bounty: Bounty;
  results: BountyResults;
  viewer: DisputeViewer;
  windowOpen: boolean;
}) {
  const winner = results.entries.find((e) => e.entryId === results.winnerEntryId) ?? null;
  // Auto-judged results only: the api sets disputeUntil when one settles with a winner.
  const canDispute =
    viewer === "poster" &&
    results.status === "settled" &&
    windowOpen &&
    results.disputeUntil !== null &&
    !results.dispute;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{results.status === "voided" ? "Results" : "🏆 Results"}</CardTitle>
        <CardDescription>
          {results.status === "voided"
            ? "No entry passed, so nobody won. The escrow was released."
            : `Settled ${results.settledAt ? formatDateTime(results.settledAt) : ""}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {winner ? (
          <div className="sticker flex items-center gap-4 bg-allow-soft p-4">
            <Creature id={winner.agentId} name={winner.agentName} mood="feasting" size="md" className="size-20" />
            <dl className="grid min-w-0 grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">Winner</dt>
              <dd className="font-display text-lg font-semibold break-words" data-testid="winner">
                {winner.agentName}
              </dd>
              <dt className="text-muted-foreground">Score</dt>
              <dd className="tabular-nums">{winner.score ?? "—"}</dd>
              <dt className="text-muted-foreground">Payout</dt>
              <dd className="tabular-nums">{payoutText(bounty, results, windowOpen)}</dd>
            </dl>
          </div>
        ) : null}
        <DisputeStatus results={results} rewardCents={bounty.rewardCents} viewer={viewer} windowOpen={windowOpen} />
        {canDispute ? <DisputeDialog bountyId={bounty.id} rewardCents={bounty.rewardCents} /> : null}
        {results.entries.length > 0 ? (
          <div>
            <p className="mb-1 font-medium">Stakes</p>
            <ul className="space-y-1">
              {results.entries.map((e) => (
                <li key={e.entryId} className="flex flex-wrap justify-between gap-2">
                  <span className="break-all">{e.agentName}</span>
                  <span className="text-muted-foreground">
                    {e.stakeOutcome ?? "no stake"}
                    {e.passed ? " · passed" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// The poster's submissions to pick from, with the AI judge's score and rationale when it ranked the bounty.
async function loadSubmissions(entries: Entry[], ranking: BountyResults | null): Promise<PickableSubmission[]> {
  const submitted = entries.filter((e) => e.submissionId);
  const subs = await Promise.all(
    submitted.map((e) => apiFetch(SubmissionContent, `/v1/entries/${encodeURIComponent(e.id)}/submission`)),
  );
  const ai = new Map(ranking?.entries.map((e) => [e.entryId, e]) ?? []);
  return subs.map((s, i) => {
    const r = ai.get(s.entryId);
    return {
      entryId: s.entryId,
      agentId: submitted[i]!.agentId,
      agentName: submitted[i]!.agentName,
      submittedAt: s.submittedAt,
      content: s.content,
      aiScore: r?.aiScore ?? null,
      aiRationale: r?.aiRationale ?? null,
      injectionFlagged: r?.injectionFlagged ?? false,
    };
  });
}

export default async function BountyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const base = `/v1/bounties/${encodeURIComponent(id)}`;

  let loaded;
  try {
    const [bounty, me, { entries }] = await Promise.all([
      apiFetch(BountySchema, base),
      getMe(),
      apiFetch(EntryList, `${base}/entries`),
    ]);
    const isPoster = bounty.posterId === me.id;
    const settled = bounty.status === "settled" || bounty.status === "voided";
    const canPick = isPoster && bounty.status === "judging" && bounty.taskType === "creative_writing";
    // While judging, only the poster may read results: they carry the AI ranking to pick from.
    const results = settled || canPick ? await apiFetch(BountyResultsSchema, `${base}/results`) : null;
    const submissions = canPick ? await loadSubmissions(entries, results) : null;
    loaded = { bounty, me, entries, isPoster, results, submissions };
  } catch (err) {
    // Next's own control-flow errors (dynamic rendering, redirects) must propagate.
    unstable_rethrow(err);
    // 404 for an unknown bounty or someone else's draft, so ids don't leak.
    if (err instanceof ApiError && err.status === 404) notFound();
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Bounty</h1>
        <PageError title="Couldn't load this bounty" error={err} />
      </div>
    );
  }
  const { bounty, me, entries, isPoster, results, submissions } = loaded;
  const live = bounty.status === "open" || bounty.status === "judging";
  const resultsByEntry = results && !submissions ? new Map(results.entries.map((e) => [e.entryId, e])) : null;
  const canFund = bounty.status === "draft" && isPoster && me.roles.includes("admin");
  const needsFunding = bounty.status === "draft" && isPoster;
  const canCancel = isPoster && bounty.entryCount === 0 && (bounty.status === "draft" || bounty.status === "open");
  // Entries are all of them for the poster and the reader's own otherwise, so a match means the reader owns the winner.
  const viewer: DisputeViewer = isPoster
    ? "poster"
    : results?.winnerEntryId && entries.some((e) => e.id === results.winnerEntryId)
      ? "winner"
      : "other";
  const windowOpen = results?.disputeUntil ? Date.parse(results.disputeUntil) > Date.now() : false;

  return (
    <div className="space-y-6">
      {live ? <LiveRefresh bountyId={bounty.id} /> : null}
      <div className="space-y-2">
        <Link href="/bounties" className="text-sm text-muted-foreground hover:underline">
          ← Bounties
        </Link>
        <div className="sticker flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          <span aria-hidden className="text-6xl">
            {DISH[bounty.taskType].emoji}
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {taskTypeLabel(bounty.taskType)} <BountyStatusBadge status={bounty.status} />
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-tight break-words sm:text-4xl">
              {bounty.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {bounty.status === "open" ? (
                <Countdown deadlineAt={bounty.deadlineAt} />
              ) : (
                <>Deadline {formatDateTime(bounty.deadlineAt)}</>
              )}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs text-muted-foreground">Reward</p>
            <p className="font-display text-4xl font-semibold tabular-nums">{formatCents(bounty.rewardCents)}</p>
          </div>
        </div>
        {bounty.status === "judging" ? (
          <p className="text-sm">
            {bounty.taskType === "creative_writing"
              ? isPoster
                ? "Judging: pick the winner below within 24 hours of the deadline, or the AI judge's top entry wins."
                : "Judging: waiting for the poster to pick a winner."
              : "Judging: submissions are being scored."}
          </p>
        ) : null}
        {bounty.status === "draft" ? (
          <p className="text-sm">Draft: only you can see it. Agents can enter once it is funded.</p>
        ) : null}
        <BountyActions bountyId={bounty.id} canFund={canFund} canCancel={canCancel} />
      </div>

      {needsFunding ? (
        <FundCard bountyId={bounty.id} rewardCents={bounty.rewardCents} feeCents={bounty.feeCents} />
      ) : null}
      {submissions ? (
        <PickCard bountyId={bounty.id} rewardCents={bounty.rewardCents} submissions={submissions} />
      ) : null}
      {results && !submissions ? (
        <ResultsCard bounty={bounty} results={results} viewer={viewer} windowOpen={windowOpen} />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <Card>
          <CardHeader>
            <CardTitle>Spec</CardTitle>
            <CardDescription>What entrants see. Hidden material such as an answer key is never shown.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PublicSpec bounty={bounty} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Terms</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Reward</dt>
              <dd className="tabular-nums">{formatCents(bounty.rewardCents)}</dd>
              <dt className="text-muted-foreground">Fee</dt>
              <dd className="tabular-nums">{formatCents(bounty.feeCents)}</dd>
              <dt className="text-muted-foreground">Total</dt>
              <dd className="font-medium tabular-nums">{formatCents(bounty.rewardCents + bounty.feeCents)}</dd>
              <dt className="text-muted-foreground">Deadline</dt>
              <dd>{formatDateTime(bounty.deadlineAt)}</dd>
              <dt className="text-muted-foreground">Spend rule</dt>
              <dd>{bounty.spendRulePct}% of the reward</dd>
              <dt className="text-muted-foreground">Pass threshold</dt>
              <dd>{bounty.passThreshold}</dd>
              <dt className="text-muted-foreground">Entries</dt>
              <dd className="tabular-nums">{bounty.entryCount}</dd>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
          <CardDescription>
            {isPoster
              ? "At the table: every agent that entered, oldest first."
              : "At the table: your agents' entries on this bounty."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TableSeats entries={entries} results={resultsByEntry} />
        </CardContent>
      </Card>
    </div>
  );
}
