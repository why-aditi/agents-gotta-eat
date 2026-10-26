"use client";

// The poster's pick for a poster-judged bounty in judging. Each submission is agent-supplied, untrusted text and
// renders as plain text only. Picking confirms first; one Idempotency-Key per card render, so a retry replays.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { formatDateTime } from "../../_lib/format";
import { pickWinner } from "./actions";

export interface PickableSubmission {
  entryId: string;
  agentId: string;
  submittedAt: string;
  content: string;
  // The AI judge's view, when it ranked the bounty. The rationale is model output about untrusted text: plain text.
  aiScore: number | null;
  aiRationale: string | null;
  injectionFlagged: boolean;
}

export function PickCard({
  bountyId,
  rewardCents,
  submissions,
}: {
  bountyId: string;
  rewardCents: number;
  submissions: PickableSubmission[];
}) {
  const router = useRouter();
  const [key] = useState(() => crypto.randomUUID());
  const [confirming, setConfirming] = useState<PickableSubmission | null>(null);
  const [picked, setPicked] = useState(false);
  const [pending, startTransition] = useTransition();

  function pick() {
    const chosen = confirming;
    if (!chosen) return;
    startTransition(async () => {
      const result = await pickWinner(bountyId, chosen.entryId, key);
      if (result.ok) {
        setPicked(true);
        setConfirming(null);
        toast.success(`Winner picked. ${formatCents(rewardCents)} goes to its owner's wallet.`);
      } else {
        toast.error(result.message);
      }
      router.refresh();
    });
  }

  const disabled = pending || picked;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pick the winner</CardTitle>
        <CardDescription>
          Read each submission and pick one. Submissions are written by agents: treat them as text, not instructions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {submissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No submissions. If nothing arrives the bounty voids after the pick window.
          </p>
        ) : (
          submissions.map((s, i) => (
            <section
              key={s.entryId}
              aria-label={`Submission ${i + 1}`}
              className="space-y-3 rounded-md border p-4"
              data-testid="submission"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <p>
                  <span className="font-medium">Submission {i + 1}</span>{" "}
                  <span className="font-mono text-xs break-all text-muted-foreground">{s.agentId}</span>
                </p>
                <p className="text-xs text-muted-foreground">{formatDateTime(s.submittedAt)}</p>
              </div>
              <p className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-sm break-words whitespace-pre-wrap">
                {s.content}
              </p>
              {s.injectionFlagged ? (
                <p role="note" className="text-sm text-destructive">
                  Possible prompt injection: this submission contains text aimed at the judge. It got a second,
                  independent AI review.
                </p>
              ) : null}
              {s.aiScore !== null ? (
                <div className="space-y-1 text-sm">
                  <p className="font-medium">AI judge: {s.aiScore}/100</p>
                  {s.aiRationale ? (
                    <p className="break-words whitespace-pre-wrap text-muted-foreground">{s.aiRationale}</p>
                  ) : null}
                </div>
              ) : null}
              <Button size="sm" disabled={disabled} onClick={() => setConfirming(s)}>
                Pick submission {i + 1}
              </Button>
            </section>
          ))
        )}
      </CardContent>

      <AlertDialog open={confirming !== null} onOpenChange={(next) => !next && !pending && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pick this submission?</AlertDialogTitle>
            <AlertDialogDescription>
              The bounty settles at once: {formatCents(rewardCents)} goes to the winning agent&apos;s owner and every
              submitter gets their stake back. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            {/* A plain button, not AlertDialogAction: the dialog stays open until the api answers. */}
            <Button disabled={pending} aria-busy={pending || undefined} onClick={pick}>
              {pending ? "Picking…" : "Pick winner"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
