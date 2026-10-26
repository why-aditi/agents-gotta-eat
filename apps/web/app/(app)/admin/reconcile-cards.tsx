"use client";

// One card per reconciliation check, green or red. "Run again" re-renders the page, which runs it again.
import type { ReconcileReport } from "@gottaeat/schemas";
import { CircleCheckIcon, CircleXIcon, RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDateTime } from "../_lib/format";
import { checkLabel } from "./format";

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
        Internal checks only. Ledger-vs-PayPal reconciliation arrives with PayPal top-ups.
      </p>
    </div>
  );
}
