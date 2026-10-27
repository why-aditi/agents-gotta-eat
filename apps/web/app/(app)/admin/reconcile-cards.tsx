"use client";

// One card per reconciliation check, green or red. "Run again" re-renders the page, which runs it again.
// Below them, the ledger-vs-PayPal card, run on demand.
import type { PayPalReconcileReport, ReconcileReport } from "@gottaeat/schemas";
import { CircleCheckIcon, CircleXIcon, RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDateTime } from "../_lib/format";
import { runPayPalReconcile } from "./actions";
import { checkLabel, reconcileStatusLabel, signedCents } from "./format";

export function ReconcileCards({ report }: { report: ReconcileReport }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const failed = report.checks.filter((c) => !c.ok).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p
            role="status"
            className={cn(
              "text-lg font-semibold",
              report.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive",
            )}
          >
            {report.ok ? "All checks pass" : `${failed} of ${report.checks.length} checks failed`}
          </p>
          <p className="text-sm text-muted-foreground">Checked {formatDateTime(report.checkedAt)}</p>
        </div>
        <Button variant="outline" onClick={() => startTransition(() => router.refresh())} disabled={pending}>
          <RefreshCwIcon className={cn("size-4", pending && "animate-spin")} aria-hidden />
          {pending ? "Running…" : "Run again"}
        </Button>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {report.checks.map((check) => (
          <li key={check.name}>
            <Card
              data-ok={check.ok}
              className={cn(
                "h-full border-l-4",
                check.ok ? "border-l-emerald-600 dark:border-l-emerald-400" : "border-l-destructive",
              )}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {check.ok ? (
                    <CircleCheckIcon className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  ) : (
                    <CircleXIcon className="size-5 text-destructive" aria-hidden />
                  )}
                  {checkLabel(check.name)}
                  <span className="sr-only">{check.ok ? "(pass)" : "(fail)"}</span>
                </CardTitle>
                <CardDescription className="break-words font-mono text-xs">{check.detail}</CardDescription>
              </CardHeader>
            </Card>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Internal checks of the ledger. The PayPal card below matches the ledger against PayPal itself.
      </p>
      <PayPalReconcileCard />
    </div>
  );
}

const COUNT_ORDER = [
  "matched",
  "pending",
  "missing_in_paypal",
  "missing_in_ledger",
  "amount_mismatch",
  "unrelated",
] as const;
const PROBLEMS = new Set(["missing_in_paypal", "missing_in_ledger", "amount_mismatch"]);

// Ledger vs PayPal's transaction search (through the Agent Toolkit). Runs on demand only: the api caches a run for
// 15 minutes, and "Run against PayPal" after the first run asks for a fresh one.
export function PayPalReconcileCard() {
  const [report, setReport] = useState<PayPalReconcileReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = () =>
    startTransition(async () => {
      const res = await runPayPalReconcile(report !== null);
      if (res.ok) {
        setReport(res.data);
        setError(null);
      } else {
        setError(res.message);
      }
    });
  const unmatched = report?.lines.filter((l) => l.status !== "matched") ?? [];
  const state = error ? "error" : !report ? "idle" : report.ok ? "ok" : "mismatch";
  return (
    <Card
      data-testid="paypal-reconcile"
      data-state={state}
      className={cn(
        "border-l-4",
        state === "ok" && "border-l-emerald-600 dark:border-l-emerald-400",
        (state === "mismatch" || state === "error") && "border-l-destructive",
      )}
    >
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            {state === "ok" ? (
              <CircleCheckIcon className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            ) : state === "mismatch" || state === "error" ? (
              <CircleXIcon className="size-5 text-destructive" aria-hidden />
            ) : null}
            PayPal
          </CardTitle>
          <CardDescription aria-live="polite" data-testid="paypal-reconcile-summary">
            {state === "idle" && "Matches every PayPal movement in the ledger with PayPal's transaction search."}
            {state === "error" && error}
            {report && state !== "error"
              ? `${report.ok ? "Ledger matches PayPal" : "Ledger and PayPal disagree"} · last ${report.window.days} days · checked ${formatDateTime(report.checkedAt)}${report.cached ? " (cached)" : ""}`
              : null}
          </CardDescription>
        </div>
        <Button variant="outline" onClick={run} disabled={pending}>
          <RefreshCwIcon className={cn("size-4", pending && "animate-spin")} aria-hidden />
          {pending ? "Running…" : "Run against PayPal"}
        </Button>
      </CardHeader>
      {report ? (
        <CardContent className="space-y-3">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {COUNT_ORDER.map((k) => (
              <div key={k} className="rounded-md bg-muted/50 px-3 py-2">
                <dt className="text-xs text-muted-foreground">{reconcileStatusLabel(k)}</dt>
                <dd
                  data-testid={`count-${k}`}
                  className={cn(
                    "text-lg font-semibold tabular-nums",
                    PROBLEMS.has(k) && report.counts[k] > 0 && "text-destructive",
                  )}
                >
                  {report.counts[k]}
                </dd>
              </div>
            ))}
          </dl>
          {unmatched.length ? (
            <div className="overflow-x-auto rounded-md border">
              <Table aria-label="Unmatched PayPal lines">
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>PayPal id</TableHead>
                    <TableHead className="text-right">Ledger</TableHead>
                    <TableHead className="text-right">PayPal</TableHead>
                    <TableHead>Refs</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unmatched.map((l) => (
                    <TableRow key={l.paypalId}>
                      <TableCell className={cn(PROBLEMS.has(l.status) && "text-destructive")}>
                        {reconcileStatusLabel(l.status)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{l.paypalId}</TableCell>
                      <TableCell className="text-right tabular-nums">{signedCents(l.ledgerCents)}</TableCell>
                      <TableCell className="text-right tabular-nums">{signedCents(l.paypalCents)}</TableCell>
                      <TableCell className="max-w-56 truncate font-mono text-xs" title={l.refs.join(", ")}>
                        {l.refs.join(", ") || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{l.detail}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Every PayPal movement in the window is matched.</p>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
