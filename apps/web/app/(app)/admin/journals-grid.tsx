"use client";

// Journals newest first. "Load more" appends the next cursor page; clicking a row opens its lines.
import type { AdminJournal, AdminJournalDetail } from "@gottaeat/schemas";
import type { ColDef } from "ag-grid-community";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { DataGrid } from "@/components/data-grid";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCents } from "@/lib/money";
import { formatDateTime } from "../_lib/format";
import { loadJournal, loadJournals } from "./actions";
import { centsCell, dateCell } from "./format";

const COLUMNS: ColDef<AdminJournal>[] = [
  { field: "createdAt", headerName: "Created", valueFormatter: dateCell, minWidth: 170, sort: "desc" },
  { field: "kind", headerName: "Kind", maxWidth: 120 },
  {
    colId: "ref",
    headerName: "Ref",
    valueGetter: (p) => (p.data?.refType ? `${p.data.refType}:${p.data.refId ?? ""}` : (p.data?.refId ?? "")),
    minWidth: 200,
  },
  {
    field: "totalCents",
    headerName: "Total",
    valueFormatter: centsCell,
    type: "rightAligned",
    cellClass: ["ag-right-aligned-cell", "tabular-nums"],
    maxWidth: 140,
  },
  { field: "lineCount", headerName: "Lines", type: "rightAligned", maxWidth: 100 },
  { field: "idempotencyKey", headerName: "Idempotency key", minWidth: 220 },
];

export function JournalsGrid({ initial, nextCursor }: { initial: AdminJournal[]; nextCursor: string | null }) {
  const [rows, setRows] = useState(initial);
  const [cursor, setCursor] = useState(nextCursor);
  const [loadingMore, startLoadMore] = useTransition();
  const [open, setOpen] = useState<AdminJournal | null>(null);
  const [detail, setDetail] = useState<AdminJournalDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const latest = useRef<string | null>(null);

  function loadMore() {
    if (!cursor) return;
    startLoadMore(async () => {
      const res = await loadJournals(cursor);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      // Guard against a double click appending the same page twice.
      setRows((prev) => {
        const seen = new Set(prev.map((j) => j.id));
        return [...prev, ...res.data.items.filter((j) => !seen.has(j.id))];
      });
      setCursor(res.data.nextCursor);
    });
  }

  async function openJournal(journal: AdminJournal) {
    setOpen(journal);
    setDetail(null);
    setDetailError(null);
    latest.current = journal.id;
    const res = await loadJournal(journal.id);
    // A slower answer for a row opened earlier must not replace the current one.
    if (latest.current !== journal.id) return;
    if (res.ok) setDetail(res.data);
    else setDetailError(res.message);
  }

  return (
    <div className="space-y-3">
      <DataGrid
        rows={rows}
        columns={COLUMNS}
        getRowId={(j) => j.id}
        ariaLabel="Journals"
        onRowClicked={openJournal}
        emptyMessage="No journals yet."
      />
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {rows.length} journal{rows.length === 1 ? "" : "s"} loaded{cursor ? "" : " (all)"}
        </span>
        {cursor ? (
          <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        ) : null}
      </div>
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Journal {open?.kind} {open ? `· ${formatCents(open.totalCents)}` : ""}
            </DialogTitle>
            <DialogDescription className="break-all font-mono text-xs">
              {open?.id} · {open ? formatDateTime(open.createdAt) : ""}
            </DialogDescription>
          </DialogHeader>
          {detailError ? (
            <p role="alert" className="text-sm text-destructive">
              {detailError}
            </p>
          ) : detail ? (
            <JournalLines detail={detail} />
          ) : (
            <div className="space-y-2" aria-busy="true" aria-label="Loading lines">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function JournalLines({ detail }: { detail: AdminJournalDetail }) {
  const debits = detail.lines.reduce((s, l) => s + l.debitCents, 0);
  const credits = detail.lines.reduce((s, l) => s + l.creditCents, 0);
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Account</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Debit</TableHead>
            <TableHead className="text-right">Credit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {detail.lines.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="max-w-64 truncate font-mono text-xs" title={l.accountId}>
                {l.accountId}
              </TableCell>
              <TableCell className="text-muted-foreground">{l.accountType}</TableCell>
              <TableCell className="text-right tabular-nums">{l.debitCents ? formatCents(l.debitCents) : ""}</TableCell>
              <TableCell className="text-right tabular-nums">
                {l.creditCents ? formatCents(l.creditCents) : ""}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>Total</TableCell>
            <TableCell className="text-right tabular-nums">{formatCents(debits)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCents(credits)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
