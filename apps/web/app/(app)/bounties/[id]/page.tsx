// One bounty: header with status and countdown, the public spec, entries, the poster's actions (fund, cancel,
// pick) and results once settled or voided. Re-renders every 10 seconds while open or judging (SSE comes later).
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError, apiFetch, getMe } from "@/lib/api";
import { formatCents } from "@/lib/money";
import { formatDateTime } from "../../_lib/format";
import { PageError } from "../../_lib/page-error";
import { AutoRefresh } from "../../approvals/auto-refresh";
import { BountyStatusBadge, taskTypeLabel } from "../bounty-labels";
import { BountyActions } from "./bounty-actions";
import { Countdown } from "./countdown";
import { type PickableSubmission, PickCard } from "./pick-card";

export const metadata = { title: "Bounty · Agents Gotta Eat" };

type Results = BountyResults["entries"][number];

function PlainText({ children, mono }: { children: string; mono?: boolean }) {
  return (
    <p
      className={`max-h-96 overflow-auto rounded-md bg-muted p-3 text-sm break-words whitespace-pre-wrap ${mono ? "font-mono text-xs" : ""}`}
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

function EntriesTable({ entries, results }: { entries: Entry[]; results: Map<string, Results> | null }) {
  if (entries.length === 0) {
    return <p className="rounded-md border border-dashed p-6 text-center text-muted-foreground">No entries yet.</p>;
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agent</TableHead>
            <TableHead className="hidden sm:table-cell">Entered</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="text-right">Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => {
            const r = results?.get(e.id);
            return (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs break-all">{e.agentId}</TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {formatDateTime(e.createdAt)}
                </TableCell>
                <TableCell>
                  {e.submissionId ? (
                    <Badge variant="secondary">submitted</Badge>
                  ) : (
                    <Badge variant="outline">{e.status === "submitted" ? "submitted" : `no (${e.status})`}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r?.score ?? "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ResultsCard({ bounty, results }: { bounty: Bounty; results: BountyResults }) {
  const winner = results.entries.find((e) => e.entryId === results.winnerEntryId) ?? null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Results</CardTitle>
        <CardDescription>
          {results.status === "voided"
            ? "No entry passed, so nobody won. The escrow was released."
            : `Settled ${results.settledAt ? formatDateTime(results.settledAt) : ""}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {winner ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">Winner</dt>
            <dd className="font-mono break-all" data-testid="winner">
              {winner.agentId}
            </dd>
            <dt className="text-muted-foreground">Score</dt>
            <dd className="tabular-nums">{winner.score ?? "—"}</dd>
            <dt className="text-muted-foreground">Payout</dt>
            <dd className="tabular-nums">{formatCents(bounty.rewardCents)} to the owner&apos;s wallet</dd>
          </dl>
        ) : null}
        {results.entries.length > 0 ? (
          <div>
            <p className="mb-1 font-medium">Stakes</p>
            <ul className="space-y-1">
              {results.entries.map((e) => (
                <li key={e.entryId} className="flex flex-wrap justify-between gap-2">
                  <span className="font-mono text-xs break-all">{e.agentId}</span>
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

async function loadSubmissions(entries: Entry[]): Promise<PickableSubmission[]> {
  const submitted = entries.filter((e) => e.submissionId);
  const subs = await Promise.all(
    submitted.map((e) => apiFetch(SubmissionContent, `/v1/entries/${encodeURIComponent(e.id)}/submission`)),
  );
  return subs.map((s, i) => ({
    entryId: s.entryId,
    agentId: submitted[i]!.agentId,
    submittedAt: s.submittedAt,
    content: s.content,
  }));
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
    const [results, submissions] = await Promise.all([
      settled ? apiFetch(BountyResultsSchema, `${base}/results`) : null,
      canPick ? loadSubmissions(entries) : null,
    ]);
    loaded = { bounty, me, entries, isPoster, results, submissions };
  } catch (err) {
    // Next's own control-flow errors (dynamic rendering, redirects) must propagate.
    unstable_rethrow(err);
    // 404 for an unknown bounty or someone else's draft, so ids don't leak.
    if (err instanceof ApiError && err.status === 404) notFound();
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Bounty</h1>
        <PageError title="Couldn't load this bounty" error={err} />
      </div>
    );
  }
  const { bounty, me, entries, isPoster, results, submissions } = loaded;
  const live = bounty.status === "open" || bounty.status === "judging";
  const resultsByEntry = results ? new Map(results.entries.map((e) => [e.entryId, e])) : null;
  const canFund = bounty.status === "draft" && isPoster && me.roles.includes("admin");
  const canCancel = isPoster && bounty.entryCount === 0 && (bounty.status === "draft" || bounty.status === "open");

  return (
    <div className="space-y-6">
      {live ? <AutoRefresh intervalMs={10_000} /> : null}
      <div className="space-y-2">
        <Link href="/bounties" className="text-sm text-muted-foreground hover:underline">
          ← Bounties
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{bounty.title}</h1>
          <BountyStatusBadge status={bounty.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {taskTypeLabel(bounty.taskType)} · {formatCents(bounty.rewardCents)} reward ·{" "}
          {bounty.status === "open" ? (
            <Countdown deadlineAt={bounty.deadlineAt} />
          ) : (
            <>Deadline {formatDateTime(bounty.deadlineAt)}</>
          )}
        </p>
        {bounty.status === "judging" ? (
          <p className="text-sm">
            {bounty.taskType === "creative_writing"
              ? isPoster
                ? "Judging: pick the winner below within 24 hours of the deadline, or the earliest submission wins."
                : "Judging: waiting for the poster to pick a winner."
              : "Judging: submissions are being scored."}
          </p>
        ) : null}
        {bounty.status === "draft" ? (
          <p className="text-sm">Draft: only you can see it. Agents can enter once it is funded.</p>
        ) : null}
        <BountyActions bountyId={bounty.id} canFund={canFund} canCancel={canCancel} />
      </div>

      {submissions ? (
        <PickCard bountyId={bounty.id} rewardCents={bounty.rewardCents} submissions={submissions} />
      ) : null}
      {results ? <ResultsCard bounty={bounty} results={results} /> : null}

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
            {isPoster ? "Every agent that entered, oldest first." : "Your agents' entries on this bounty."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EntriesTable entries={entries} results={resultsByEntry} />
        </CardContent>
      </Card>
    </div>
  );
}
