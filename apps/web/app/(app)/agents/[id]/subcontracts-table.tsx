"use client";

// The agent's subcontracts: jobs it hired other agents for and jobs it works on. Task, deliverable, reject reason
// and agent names are agent-supplied, untrusted text: they render as React text only (never HTML), in a dialog.
import type { Subcontract, SubcontractStatus } from "@gottaeat/schemas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCents } from "@/lib/money";
import { formatDateTime } from "../../_lib/format";

export const SUBCONTRACT_STATUS_LABEL: Record<SubcontractStatus, string> = {
  offered: "waiting for owner",
  open: "open",
  delivered: "delivered",
  accepted: "accepted",
  rejected: "rejected",
  declined: "declined",
  cancelled: "cancelled",
  expired: "expired",
};

const STATUS_CLASS: Partial<Record<SubcontractStatus, string>> = {
  accepted: "border-allow/30 bg-allow-soft text-allow",
  open: "border-paypal/30 bg-paypal-soft text-paypal",
  delivered: "border-chart-5/30 bg-chart-5/15 text-chart-5",
  offered: "border-flag/30 bg-flag-soft text-flag",
};

function SubcontractStatusBadge({ status }: { status: SubcontractStatus }) {
  const className = STATUS_CLASS[status];
  return (
    <Badge variant={className ? "outline" : "secondary"} className={className}>
      {SUBCONTRACT_STATUS_LABEL[status]}
    </Badge>
  );
}

function PlainText({ label, text, testId }: { label: string; text: string; testId: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <pre
        data-testid={testId}
        className="max-h-64 overflow-auto rounded-md bg-muted p-3 font-mono text-xs break-words whitespace-pre-wrap"
      >
        {text}
      </pre>
    </div>
  );
}

function JobDialog({ job, hired }: { job: Subcontract; hired: boolean }) {
  const counterparty = hired ? job.workerAgentName : job.hirerAgentName;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          View job
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="break-words">{hired ? `Hired ${counterparty}` : `Working for ${counterparty}`}</DialogTitle>
          <DialogDescription>
            {formatCents(job.amountCents)} + {formatCents(job.feeCents)} fee · {SUBCONTRACT_STATUS_LABEL[job.status]}.
            Task and deliverable come from agents: read them as plain text.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <PlainText label="Task" text={job.task} testId="subcontract-task" />
          {job.deliverable !== null ? (
            <PlainText label="Deliverable" text={job.deliverable} testId="subcontract-deliverable" />
          ) : (
            <p className="text-sm text-muted-foreground">Nothing delivered yet.</p>
          )}
          {job.rejectReason !== null ? (
            <PlainText label="Reject reason" text={job.rejectReason} testId="subcontract-reject-reason" />
          ) : null}
          <p className="font-mono text-xs text-muted-foreground">{job.id}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SubcontractsTable({ agentId, subcontracts }: { agentId: string; subcontracts: Subcontract[] }) {
  if (subcontracts.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">No subcontracts yet.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Role</TableHead>
          <TableHead>Counterparty</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Deliver by</TableHead>
          <TableHead>Rating</TableHead>
          <TableHead className="sr-only">Details</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {subcontracts.map((job) => {
          const hired = job.hirerAgentId === agentId;
          return (
            <TableRow key={job.id} data-testid="subcontract-row">
              <TableCell>{hired ? "Hired" : "Working"}</TableCell>
              <TableCell className="max-w-48 truncate">{hired ? job.workerAgentName : job.hirerAgentName}</TableCell>
              <TableCell>
                <SubcontractStatusBadge status={job.status} />
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatCents(job.amountCents)}</TableCell>
              <TableCell className="text-muted-foreground">{formatDateTime(job.deliverBy)}</TableCell>
              <TableCell className="tabular-nums">{job.rating === null ? "—" : `${job.rating} / 5`}</TableCell>
              <TableCell className="text-right">
                <JobDialog job={job} hired={hired} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
