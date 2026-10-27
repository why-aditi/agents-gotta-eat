"use client";

// The poster's "Dispute result" button and dialog for a settled auto-judged bounty while its 12-hour window is open.
// The reason is sent trimmed (1-1,000 characters). Each submit attempt gets a fresh Idempotency-Key: the reason
// may have changed since the last try, and the button stays disabled while a request is in flight.
import { MAX_DISPUTE_REASON_CHARS } from "@gottaeat/schemas";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCents } from "@/lib/money";
import { describeDisputeError } from "../../_lib/reasons";
import { openDispute } from "./actions";

export function validateReason(raw: string): string | null {
  const reason = raw.trim();
  if (reason.length === 0) return "Say why the result is wrong.";
  if (reason.length > MAX_DISPUTE_REASON_CHARS) return "Keep the reason to 1,000 characters or fewer.";
  return null;
}

// Codes after which the page is out of date: refresh so it shows the dispute or the closed window.
const STALE = new Set(["dispute_exists", "dispute_window_closed", "not_disputable"]);

export function DisputeDialog({ bountyId, rewardCents }: { bountyId: string; rewardCents: number }) {
  const uid = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    if (pending) return;
    if (!next) {
      setReason("");
      setError(null);
    }
    setOpen(next);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const problem = validateReason(reason);
    setError(problem);
    if (problem) return;
    startTransition(async () => {
      const result = await openDispute(bountyId, reason.trim(), crypto.randomUUID());
      if (result.ok) {
        setOpen(false);
        setReason("");
        toast.success("Dispute sent. An admin will review the result.");
        router.refresh();
        return;
      }
      setError(describeDisputeError(result.code, result.message));
      if (STALE.has(result.code)) router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Dispute result
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Dispute the result</DialogTitle>
            <DialogDescription>
              An admin reviews the judge&apos;s decision. If they overturn it, the {formatCents(rewardCents)} reward is
              refunded to you; the fee isn&apos;t. You can dispute once.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${uid}-reason`}>Reason</Label>
            <Textarea
              id={`${uid}-reason`}
              rows={5}
              maxLength={MAX_DISPUTE_REASON_CHARS}
              placeholder="e.g. The answer key expects 1200 but the source says 1,250."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${uid}-error` : undefined}
              disabled={pending}
            />
            <div className="flex flex-wrap items-start justify-between gap-2">
              {error ? (
                <p id={`${uid}-error`} role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : (
                <span />
              )}
              <span className="text-xs text-muted-foreground tabular-nums" data-testid="reason-count">
                {reason.length}/{MAX_DISPUTE_REASON_CHARS}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
              {pending ? "Submitting…" : "Submit dispute"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
