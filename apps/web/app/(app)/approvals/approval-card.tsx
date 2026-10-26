"use client";

// One pending spend. The countdown runs off expiresAt; at zero the buttons disable because the api would answer
// 409 approval_expired anyway. The agent's reason is untrusted text and renders as plain text only.
import type { SpendRequest } from "@gottaeat/schemas";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { formatCountdown } from "../_lib/format";
import { spendRequestReasons } from "../_lib/reasons";
import { approveSpend, denySpend } from "./actions";

function secondsLeft(expiresAt: string | null, now: number): number | null {
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
}

export function ApprovalCard({ spend, agentName }: { spend: SpendRequest; agentName?: string }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();
  const [decided, setDecided] = useState(false);
  // One key per decision, made once per card, so a double click replays instead of deciding twice.
  const [keys] = useState(() => ({ approve: crypto.randomUUID(), deny: crypto.randomUUID() }));

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const left = secondsLeft(spend.expiresAt, now);
  const expired = left === 0;
  const reasons = spendRequestReasons(spend);
  const titleId = `approval-${spend.id}`;

  function decide(decision: "approve" | "deny") {
    startTransition(async () => {
      const result =
        decision === "approve" ? await approveSpend(spend.id, keys.approve) : await denySpend(spend.id, keys.deny);
      if (result.ok) {
        setDecided(true);
        toast.success(
          decision === "approve"
            ? `Approved ${formatCents(spend.amountCents + spend.feeCents)}.`
            : "Denied. The hold was released.",
        );
      } else {
        toast.error(result.message);
        if (result.code === "approval_expired" || result.code === "already_decided") setDecided(true);
      }
      router.refresh();
    });
  }

  const disabled = pending || decided || expired;

  return (
    <Card aria-labelledby={titleId}>
      <CardHeader>
        <CardTitle id={titleId}>
          {formatCents(spend.amountCents)} to{" "}
          <span className="font-mono text-base break-all">{spend.payeeAgentId ?? "unknown payee"}</span>
        </CardTitle>
        <CardDescription>
          From {agentName ? <span className="font-medium text-foreground">{agentName}</span> : null}{" "}
          <span className="font-mono break-all">{spend.agentId}</span> · {spend.category}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">Amount + fee</dt>
          <dd className="tabular-nums">
            {formatCents(spend.amountCents)} + {formatCents(spend.feeCents)} fee ={" "}
            <span className="font-medium">{formatCents(spend.amountCents + spend.feeCents)}</span>
          </dd>
          <dt className="text-muted-foreground">Time left</dt>
          <dd className="tabular-nums" aria-live="off" suppressHydrationWarning>
            {left === null ? "No deadline" : expired ? "Expired" : `Expires in ${formatCountdown(left)}`}
          </dd>
        </dl>
        {reasons.length > 0 ? (
          <div>
            <p className="mb-1 font-medium">Why it needs you</p>
            <ul className="list-disc space-y-0.5 pl-5">
              {reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Agent&apos;s reason</p>
          <p className="rounded-md bg-muted p-3 break-words whitespace-pre-wrap text-muted-foreground">
            {spend.reason}
          </p>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button onClick={() => decide("approve")} disabled={disabled}>
          Approve
        </Button>
        <Button variant="destructive" onClick={() => decide("deny")} disabled={disabled}>
          Deny
        </Button>
      </CardFooter>
    </Card>
  );
}
