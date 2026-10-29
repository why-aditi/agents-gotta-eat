"use client";

// ui-04: an agent's meal history: every spend request it made (any status) and every earning, newest first. Each
// spend opens to show how every gate decided. Agent-supplied text (the spend reason, names) and gate 2's note
// render as plain text only: React escapes them.
import type { SpendRequest, SpendStatus, WalletActivityItem } from "@gottaeat/schemas";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { type Tone, VerdictBadge } from "@/components/app/verdict-badge";
import { Button } from "@/components/ui/button";
import { Creature } from "@/components/creature/creature";
import { mealHeadline, spendFacts } from "@/lib/kitchen";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { formatDateTime } from "../../_lib/format";
import { decisionNote, decisionReasons, GATE_LABEL, STATUS_LABEL, VERDICT_LABEL } from "../../_lib/reasons";

const STATUS_TONE: Record<SpendStatus, Tone> = {
  settled: "allow",
  allowed: "paypal",
  pending_approval: "flag",
  denied: "deny",
  released: "neutral",
};

export function StatusBadge({ status }: { status: SpendStatus }) {
  return <VerdictBadge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</VerdictBadge>;
}

function Decisions({ spend }: { spend: SpendRequest }) {
  return (
    <div className="space-y-4 pt-3">
      <ol className="space-y-3">
        {spend.decisions.map((d, i) => {
          const reasons = decisionReasons(d);
          const note = decisionNote(d);
          return (
            <li key={`${d.gate}-${i}`} className="rounded-xl border p-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-medium">{GATE_LABEL[d.gate]}</span>
                <span
                  className={cn("text-sm", d.verdict === "deny" && "text-deny", d.verdict === "ask" && "text-flag")}
                >
                  {VERDICT_LABEL[d.verdict]}
                </span>
                {d.confidence !== null ? (
                  <span className="text-xs text-muted-foreground">Confidence {d.confidence}%</span>
                ) : null}
                <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(d.createdAt)}</span>
              </div>
              {reasons.length > 0 ? (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm">
                  {reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No rules flagged.</p>
              )}
              {note ? (
                <p className="mt-2 text-xs break-words whitespace-pre-wrap text-muted-foreground">Note: {note}</p>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Agent&apos;s reason</p>
        <p
          data-testid="spend-reason"
          className="rounded-xl bg-muted p-3 text-sm break-words whitespace-pre-wrap text-muted-foreground"
        >
          {spend.reason}
        </p>
      </div>
    </div>
  );
}

type Meal =
  | { kind: "spend"; id: string; createdAt: string; spend: SpendRequest }
  | { kind: "earning"; id: string; createdAt: string; item: WalletActivityItem };

// Spends and earnings in one list, newest first; ties keep a stable order by id.
export function meals(spends: SpendRequest[], earnings: WalletActivityItem[]): Meal[] {
  const all: Meal[] = [
    ...spends.map((spend) => ({ kind: "spend" as const, id: spend.id, createdAt: spend.createdAt, spend })),
    ...earnings
      .filter((item) => item.kind === "earning")
      .map((item) => ({ kind: "earning" as const, id: item.id, createdAt: item.createdAt, item })),
  ];
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}

export function MealFeed({
  agent,
  spendRequests,
  earnings,
}: {
  agent: { id: string; name: string; kind: string };
  spendRequests: SpendRequest[];
  earnings: WalletActivityItem[];
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const list = meals(spendRequests, earnings);

  if (list.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">Nothing eaten yet.</p>;
  }

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <ol className="divide-y">
      {list.map((meal) => {
        if (meal.kind === "earning") {
          const { item } = meal;
          return (
            <li key={meal.id} data-testid="meal" data-kind="earning" className="flex items-center gap-3 py-4">
              <Creature
                id={agent.id}
                name={agent.name}
                mood="feasting"
                size="sm"
                house={agent.kind === "house"}
                still
                className="size-10 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Earned {formatCents(item.amountCents)}</p>
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-xs text-muted-foreground sm:hidden">{formatDateTime(item.createdAt)}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-medium text-allow tabular-nums">+{formatCents(item.amountCents)}</span>
                <span className="hidden text-xs text-muted-foreground sm:inline">{formatDateTime(item.createdAt)}</span>
              </div>
            </li>
          );
        }
        const s = meal.spend;
        const expanded = open.has(s.id);
        const panelId = `decisions-${s.id}`;
        return (
          <li key={meal.id} data-testid="meal" data-kind="spend" data-status={s.status} className="py-4">
            <div className="flex items-start gap-3 sm:items-center">
              <Creature
                id={agent.id}
                name={agent.name}
                mood={s.status === "denied" ? "sulking" : s.status === "pending_approval" ? "begging" : "fed"}
                size="sm"
                house={agent.kind === "house"}
                still
                className="size-10 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{mealHeadline(s.status, s.amountCents, s.category)}</p>
                <p className="text-sm break-words text-muted-foreground">
                  {spendFacts(s.amountCents, s.feeCents, s.category, s.payeeAgentName)}
                </p>
                {/* On a phone the status and time sit under the facts instead of beside them. */}
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:hidden">
                  <StatusBadge status={s.status} />
                  {formatDateTime(s.createdAt)}
                </p>
              </div>
              <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                <StatusBadge status={s.status} />
                <span className="text-xs text-muted-foreground">{formatDateTime(s.createdAt)}</span>
              </div>
            </div>
            <div className="mt-1 pl-13">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 h-7 text-muted-foreground"
                aria-expanded={expanded}
                aria-controls={expanded ? panelId : undefined}
                onClick={() => toggle(s.id)}
              >
                {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
                {expanded ? "Hide decisions" : "Show decisions"}
              </Button>
              {expanded ? (
                <div id={panelId}>
                  <Decisions spend={s} />
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
