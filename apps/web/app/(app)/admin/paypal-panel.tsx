"use client";

// The PayPal call log and the stored webhook events, newest first, 100 at a time with "Load more". Neither shows
// bodies or tokens: the api never stores them in the call log and never returns webhook payloads.
import type { PayPalCall, PayPalCallList, WebhookEventList, WebhookEventSummary } from "@gottaeat/schemas";
import type { ColDef } from "ag-grid-community";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { DataGrid } from "@/components/data-grid";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/actions";
import { loadPayPalCalls, loadWebhookEvents } from "./actions";
import { dateCell } from "./format";

const dash = ({ value }: { value: unknown }) =>
  value === null || value === undefined || value === "" ? "—" : String(value);

const CALL_COLUMNS: ColDef<PayPalCall>[] = [
  { field: "createdAt", headerName: "Time", valueFormatter: dateCell, minWidth: 190, sort: "desc" },
  { field: "source", headerName: "Source", maxWidth: 110 },
  { field: "method", headerName: "Method", maxWidth: 100 },
  { field: "path", headerName: "Path", minWidth: 280, flex: 2 },
  {
    field: "status",
    headerName: "Status",
    maxWidth: 110,
    type: "rightAligned",
    valueFormatter: (p) => (p.value === null ? "no response" : String(p.value)),
    cellClass: (p) => (p.value === null || (typeof p.value === "number" && p.value >= 400) ? "text-destructive" : ""),
  },
  { field: "durationMs", headerName: "ms", maxWidth: 90, type: "rightAligned" },
  { field: "debugId", headerName: "Debug id", minWidth: 140, valueFormatter: dash },
  { field: "requestId", headerName: "Request id", minWidth: 200, valueFormatter: dash },
];

const WEBHOOK_COLUMNS: ColDef<WebhookEventSummary>[] = [
  { field: "receivedAt", headerName: "Received", valueFormatter: dateCell, minWidth: 190, sort: "desc" },
  { field: "type", headerName: "Type", minWidth: 260, flex: 2 },
  { field: "paypalEventId", headerName: "PayPal event id", minWidth: 200 },
  {
    field: "processedAt",
    headerName: "Processed",
    minWidth: 190,
    valueFormatter: (p) => (typeof p.value === "string" ? dateCell(p) : "not yet"),
  },
  {
    field: "error",
    headerName: "Error",
    minWidth: 200,
    flex: 1,
    valueFormatter: dash,
    cellClass: (p) => (p.value ? "text-destructive" : ""),
  },
];

function usePages<T extends { id: string | number }>(
  initial: { items: T[]; nextCursor: string | null },
  load: (cursor: string) => Promise<ActionResult<{ items: T[]; nextCursor: string | null }>>,
) {
  const [rows, setRows] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loading, start] = useTransition();
  const more = () => {
    if (!cursor) return;
    start(async () => {
      const res = await load(cursor);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...res.data.items.filter((r) => !seen.has(r.id))];
      });
      setCursor(res.data.nextCursor);
    });
  };
  return { rows, cursor, loading, more };
}

function Footer({
  count,
  noun,
  cursor,
  loading,
  more,
}: {
  count: number;
  noun: string;
  cursor: string | null;
  loading: boolean;
  more: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>
        {count} {noun}
        {count === 1 ? "" : "s"} loaded{cursor ? "" : " (all)"}
      </span>
      {cursor ? (
        <Button variant="outline" size="sm" onClick={more} disabled={loading}>
          {loading ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}

export function PayPalPanel({ calls, webhooks }: { calls: PayPalCallList; webhooks: WebhookEventList }) {
  const c = usePages(calls, loadPayPalCalls);
  const w = usePages(webhooks, loadWebhookEvents);
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">PayPal calls</h2>
        <p className="text-sm text-muted-foreground">
          Every request to PayPal (each retry too), from the api&apos;s client and the Agent Toolkit. Kept 30 days. No
          bodies or tokens; query values are dropped.
        </p>
        <DataGrid
          rows={c.rows}
          columns={CALL_COLUMNS}
          getRowId={(r) => String(r.id)}
          ariaLabel="PayPal calls"
          emptyMessage="No PayPal calls yet."
        />
        <Footer count={c.rows.length} noun="call" cursor={c.cursor} loading={c.loading} more={c.more} />
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Webhook events</h2>
        <p className="text-sm text-muted-foreground">
          PayPal webhook events as received, with when they were processed and the last processing error. Payloads
          aren&apos;t shown.
        </p>
        <DataGrid
          rows={w.rows}
          columns={WEBHOOK_COLUMNS}
          getRowId={(r) => r.id}
          ariaLabel="PayPal webhook events"
          emptyMessage="No webhook events yet."
        />
        <Footer count={w.rows.length} noun="event" cursor={w.cursor} loading={w.loading} more={w.more} />
      </section>
    </div>
  );
}
