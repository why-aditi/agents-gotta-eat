"use client";

// Admin "Disputes" tab: every bounty dispute, newest first, with Uphold / Overturn for open ones. Both confirm first
// and take an optional note the poster and the winner see. The bounty title, the poster's reason and the note are
// untrusted text: plain text only.
import { type Dispute, type DisputeOutcome, MAX_DISPUTE_NOTE_CHARS } from "@gottaeat/schemas";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { DataGrid } from "@/components/data-grid";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCents } from "@/lib/money";
import { describeDisputeError } from "../_lib/reasons";
import { resolveDispute } from "./dispute-actions";
import { centsCell, dateCell } from "./format";

type Confirm = { dispute: Dispute; outcome: DisputeOutcome };

const STATUS_LABEL: Record<Dispute["status"], string> = {
  open: "open",
  upheld: "upheld",
  overturned: "overturned",
};

function TextCell({ value }: ICellRendererParams<Dispute, string | null>) {
  return <span className="break-words whitespace-pre-wrap">{value ?? "—"}</span>;
}

// Free text wraps; tighter lines than the grid's single-line rows.
const WRAP = {
  wrapText: true,
  autoHeight: true,
  cellStyle: { lineHeight: "1.4", paddingTop: "11px", paddingBottom: "11px" },
} as const;

function columns(ask: (c: Confirm) => void): ColDef<Dispute>[] {
  return [
    { field: "openedAt", headerName: "Opened", valueFormatter: dateCell, minWidth: 190, maxWidth: 210, sort: "desc" },
    {
      field: "bountyTitle",
      headerName: "Bounty",
      minWidth: 150,
      ...WRAP,
      cellRenderer: ({ data }: ICellRendererParams<Dispute>) =>
        data ? (
          <Link href={`/bounties/${encodeURIComponent(data.bountyId)}`} className="break-words hover:underline">
            {data.bountyTitle}
          </Link>
        ) : null,
    },
    {
      field: "rewardCents",
      headerName: "Reward",
      valueFormatter: centsCell,
      type: "rightAligned",
      cellClass: ["ag-right-aligned-cell", "tabular-nums"],
      maxWidth: 120,
    },
    {
      field: "status",
      headerName: "Status",
      valueFormatter: (p) => STATUS_LABEL[p.value as Dispute["status"]] ?? "",
      minWidth: 120,
      maxWidth: 130,
    },
    {
      field: "reason",
      headerName: "Reason",
      minWidth: 200,
      flex: 2,
      ...WRAP,
      cellRenderer: TextCell,
    },
    { field: "note", headerName: "Note", minWidth: 130, ...WRAP, cellRenderer: TextCell },
    {
      colId: "actions",
      headerName: "Actions",
      sortable: false,
      minWidth: 195,
      cellRenderer: ({ data }: ICellRendererParams<Dispute>) =>
        data?.status === "open" ? (
          <div className="flex items-center gap-1 pt-[5px]">
            <Button
              size="sm"
              variant="outline"
              aria-label={`Uphold ${data.bountyTitle}`}
              onClick={() => ask({ dispute: data, outcome: "uphold" })}
            >
              Uphold
            </Button>
            <Button
              size="sm"
              variant="destructive"
              aria-label={`Overturn ${data.bountyTitle}`}
              onClick={() => ask({ dispute: data, outcome: "overturn" })}
            >
              Overturn
            </Button>
          </div>
        ) : null,
    },
  ];
}

export function DisputesPanel({ disputes }: { disputes: Dispute[] }) {
  const uid = useId();
  const router = useRouter();
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const cols = useMemo(
    () =>
      columns((c) => {
        setNote("");
        setError(null);
        setConfirm(c);
        setConfirmOpen(true);
      }),
    [],
  );
  const open = disputes.filter((d) => d.status === "open").length;

  function onResolve() {
    if (!confirm) return;
    const { dispute, outcome } = confirm;
    startTransition(async () => {
      const result = await resolveDispute(dispute.id, outcome, note.trim(), crypto.randomUUID());
      if (result.ok) {
        setConfirmOpen(false);
        toast.success(
          outcome === "uphold"
            ? "Result upheld. The winner gets the reward."
            : `Result overturned. ${formatCents(dispute.rewardCents)} is going back to the poster.`,
        );
        router.refresh();
        return;
      }
      setError(describeDisputeError(result.code, result.message));
      if (result.code === "dispute_not_open") router.refresh();
    });
  }

  const reward = confirm ? formatCents(confirm.dispute.rewardCents) : "";

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {disputes.length === 0
          ? "No disputes yet."
          : `${open} open of ${disputes.length} dispute${disputes.length === 1 ? "" : "s"}. A poster can dispute an automatic result within 12 hours of settlement.`}
      </p>
      <DataGrid
        rows={disputes}
        columns={cols}
        getRowId={(d) => d.id}
        ariaLabel="Disputes"
        emptyMessage="No disputes yet."
      />

      <AlertDialog open={confirmOpen} onOpenChange={(next) => !next && !pending && setConfirmOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.outcome === "overturn" ? `Overturn and refund ${reward} to the poster?` : "Uphold the result?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.outcome === "overturn"
                ? "The reward goes back to the poster: a PayPal refund, or their wallet for a dev escrow. The platform keeps the fee and the winner stays on record."
                : `The winner's owner gets the held ${reward} reward. The poster can't dispute again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`${uid}-note`}>Note (optional)</Label>
            <Textarea
              id={`${uid}-note`}
              rows={3}
              maxLength={MAX_DISPUTE_NOTE_CHARS}
              placeholder="Shown to the poster and the winner's owner."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={pending}
            />
            <div className="flex flex-wrap items-start justify-between gap-2">
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : (
                <span />
              )}
              <span className="text-xs text-muted-foreground tabular-nums">
                {note.length}/{MAX_DISPUTE_NOTE_CHARS}
              </span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            {/* A plain button, not AlertDialogAction: the dialog stays open until the api answers. */}
            <Button
              variant={confirm?.outcome === "overturn" ? "destructive" : "default"}
              disabled={pending}
              aria-busy={pending || undefined}
              onClick={onResolve}
            >
              {pending ? "Resolving…" : confirm?.outcome === "overturn" ? "Overturn and refund" : "Uphold result"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
