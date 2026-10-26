"use client";

// The agent's spend requests, newest first. Each row expands to show every gate's decision in plain English.
// Agent-supplied text (the spend reason) and gate 2's note render as plain text only: React escapes them.
import type { SpendRequest, SpendStatus } from "@gottaeat/schemas";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { formatDateTime } from "../../_lib/format";
import {
  decisionNote,
  decisionReasons,
  GATE_LABEL,
  outcomeSummary,
  STATUS_LABEL,
  VERDICT_LABEL,
} from "../../_lib/reasons";

const STATUS_STYLE: Record<
  SpendStatus,
  { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  settled: {
    variant: "outline",
    className: "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  allowed: { variant: "outline", className: "border-sky-600/30 bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  pending_approval: {
    variant: "outline",
    className: "border-amber-600/30 bg-amber-500/10 text-amber-800 dark:text-amber-400",
  },
  denied: { variant: "destructive" },
  released: { variant: "secondary" },
};

export function StatusBadge({ status }: { status: SpendStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <Badge variant={style.variant} className={style.className}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

function Decisions({ spend }: { spend: SpendRequest }) {
  return (
    <div className="space-y-4 py-2">
      <ol className="space-y-3">
        {spend.decisions.map((d, i) => {
          const reasons = decisionReasons(d);
          const note = decisionNote(d);
          return (
            <li key={`${d.gate}-${i}`} className="rounded-md border p-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-medium">{GATE_LABEL[d.gate]}</span>
                <span
                  className={cn(
                    "text-sm",
                    d.verdict === "deny" && "text-destructive",
                    d.verdict === "ask" && "text-amber-700 dark:text-amber-400",
                  )}
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
        <p className="rounded-md bg-muted p-3 text-sm break-words whitespace-pre-wrap text-muted-foreground">
          {spend.reason}
        </p>
      </div>
    </div>
  );
}

export function SpendTimeline({ spendRequests }: { spendRequests: SpendRequest[] }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  if (spendRequests.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">No spend requests yet.</p>;
  }

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const rows = [...spendRequests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Payee</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-right">Fee</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Decision</TableHead>
          <TableHead className="sr-only">Details</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((s) => {
          const expanded = open.has(s.id);
          const panelId = `decisions-${s.id}`;
          return (
            <Fragment key={s.id}>
              <TableRow data-state={expanded ? "selected" : undefined}>
                <TableCell className="text-muted-foreground">{formatDateTime(s.createdAt)}</TableCell>
                <TableCell className="font-mono text-xs">{s.payeeAgentId ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCents(s.amountCents)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCents(s.feeCents)}</TableCell>
                <TableCell>{s.category}</TableCell>
                <TableCell>
                  <StatusBadge status={s.status} />
                </TableCell>
                <TableCell>{outcomeSummary(s)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-expanded={expanded}
                    aria-controls={expanded ? panelId : undefined}
                    onClick={() => toggle(s.id)}
                  >
                    {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
                    {expanded ? "Hide decisions" : "Show decisions"}
                  </Button>
                </TableCell>
              </TableRow>
              {expanded ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell id={panelId} colSpan={8} className="whitespace-normal">
                    <Decisions spend={s} />
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
