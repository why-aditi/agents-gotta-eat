"use client";

// Today's gateway requests against the daily budget, today's calls by role and outcome, and the last 100 calls.
import type { LlmCall, LlmUsage } from "@gottaeat/schemas";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/data-grid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { dateCell, usagePercent } from "./format";

const intCell = ({ value }: { value: unknown }) => (typeof value === "number" ? value.toLocaleString("en-US") : "—");

const COLUMNS: ColDef<LlmCall>[] = [
  { field: "createdAt", headerName: "Time", valueFormatter: dateCell, minWidth: 200 },
  { field: "role", headerName: "Role", maxWidth: 150 },
  { field: "outcome", headerName: "Outcome", maxWidth: 140 },
  { field: "model", headerName: "Model", minWidth: 140 },
  { field: "servedModel", headerName: "Served by", minWidth: 160, valueFormatter: (p) => p.value ?? "—" },
  { field: "latencyMs", headerName: "Latency (ms)", type: "rightAligned", valueFormatter: intCell, maxWidth: 140 },
  { field: "promptTokens", headerName: "Prompt tok.", type: "rightAligned", valueFormatter: intCell, maxWidth: 130 },
  {
    field: "completionTokens",
    headerName: "Output tok.",
    type: "rightAligned",
    valueFormatter: intCell,
    maxWidth: 130,
  },
];

export function UsageBar({ used, budget }: { used: number; budget: number }) {
  const pct = usagePercent(used, budget);
  const tone = pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-primary";
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-3xl font-semibold tabular-nums">
          {used.toLocaleString("en-US")}{" "}
          <span className="text-base text-muted-foreground">/ {budget.toLocaleString("en-US")}</span>
        </span>
        <span className="text-sm text-muted-foreground tabular-nums">{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="Daily LLM requests used"
        aria-valuemin={0}
        aria-valuemax={budget}
        aria-valuenow={Math.min(used, budget)}
        aria-valuetext={`${used} of ${budget} requests`}
        className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function LlmUsagePanel({ usage }: { usage: LlmUsage }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily budget</CardTitle>
            <CardDescription>Gateway requests on {usage.day} (UTC). Refused calls don&apos;t count.</CardDescription>
          </CardHeader>
          <CardContent>
            <UsageBar used={usage.used} budget={usage.budget} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Today by role</CardTitle>
            <CardDescription>Every call today, including ones the budget refused.</CardDescription>
          </CardHeader>
          <CardContent>
            {usage.byRole.length === 0 ? (
              <p className="text-sm text-muted-foreground">No calls today.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usage.byRole.map((r) => (
                    <TableRow key={`${r.role}:${r.outcome}`}>
                      <TableCell>{r.role}</TableCell>
                      <TableCell className={cn(r.outcome !== "ok" && "text-destructive")}>{r.outcome}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      <section className="space-y-2" aria-labelledby="recent-calls">
        <h2 id="recent-calls" className="text-lg font-semibold">
          Recent calls
        </h2>
        <p className="text-sm text-muted-foreground">
          The last 100 calls, any day. Prompts and outputs aren't shown here; judge prompts are kept in the judgement
          audit.
        </p>
        <DataGrid
          rows={usage.recent}
          columns={COLUMNS}
          getRowId={(c) => c.id}
          ariaLabel="Recent LLM calls"
          emptyMessage="No LLM calls yet."
        />
      </section>
    </div>
  );
}
