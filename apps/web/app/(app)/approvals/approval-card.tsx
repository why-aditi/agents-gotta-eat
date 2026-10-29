"use client";

// One pending spend. The countdown runs off expiresAt; at zero the buttons disable because the api would answer
// 409 approval_expired anyway. The agent's reason is untrusted text and renders as plain text only. ui-02: names
// and faces instead of ids, the agent's words quoted as theirs, and a stamp when the owner decides.
import type { SpendRequest } from "@gottaeat/schemas";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { HandIcon, TimerIcon } from "lucide-react";
import { AgentAvatar } from "@/components/app/agent-avatar";
import { Money } from "@/components/app/money";
import { Stamp } from "@/components/app/stamp";
import { VerdictBadge } from "@/components/app/verdict-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { formatCountdown } from "../_lib/format";
import { spendRequestReasons } from "../_lib/reasons";
import { approveSpend, denySpend } from "./actions";

// How long a decided card shows its stamp before the list refreshes.
const STAMP_MS = 900;

function secondsLeft(expiresAt: string | null, now: number): number | null {
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
}

export function ApprovalCard({ spend, agentName }: { spend: SpendRequest; agentName?: string }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();
  const [decided, setDecided] = useState(false);
  // The owner's own decision, stamped on the card; null when it closed another way (expired, decided elsewhere).
  const [outcome, setOutcome] = useState<"approve" | "deny" | null>(null);
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
        setOutcome(decision);
        toast.success(
          decision === "approve"
            ? `Approved ${formatCents(spend.amountCents + spend.feeCents)}.`
            : "Denied. The hold was released.",
        );
      } else {
        toast.error(result.message);
        if (result.code === "approval_expired" || result.code === "already_decided") setDecided(true);
      }
      // Let the stamp land before the refreshed list drops the card.
      if (result.ok) setTimeout(() => router.refresh(), STAMP_MS);
      else router.refresh();
    });
  }

  const disabled = pending || decided || expired;
  const total = spend.amountCents + spend.feeCents;
  const name = spend.agentName ?? agentName ?? "Your agent";

  return (
    <Card aria-labelledby={titleId} className={cn("relative gap-5 overflow-hidden", decided && "opacity-80")}>
      <CardHeader className="gap-3">
        <div className="flex items-start gap-3">
          <AgentAvatar id={spend.agentId} name={name} size="lg" />
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="text-lg leading-snug font-semibold">
              {name} wants <Money cents={spend.amountCents} className="font-semibold" />
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {spend.payeeAgentId ? (
                <span className="inline-flex items-center gap-1.5">
                  for
                  <AgentAvatar id={spend.payeeAgentId} name={spend.payeeAgentName ?? "?"} size="sm" />
                  <span className="font-medium text-foreground">{spend.payeeAgentName ?? "another agent"}</span>
                </span>
              ) : null}
              <VerdictBadge tone="neutral">{spend.category}</VerdictBadge>
            </div>
          </div>
          <VerdictBadge tone={expired ? "deny" : "flag"} className="shrink-0 tabular-nums">
            <TimerIcon className="size-3" aria-hidden />
            <span aria-live="off" suppressHydrationWarning>
              {left === null ? "No deadline" : expired ? "Expired" : `Expires in ${formatCountdown(left)}`}
            </span>
          </VerdictBadge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <figure className="rounded-xl border-l-4 border-flag/60 bg-muted/60 px-4 py-3">
          <figcaption className="mb-1 text-xs font-medium text-muted-foreground">
            In the agent&apos;s own words
          </figcaption>
          <blockquote className="break-words whitespace-pre-wrap text-foreground">“{spend.reason}”</blockquote>
        </figure>
        {reasons.length > 0 ? (
          <div>
            <p className="mb-1.5 font-medium">Why it needs you</p>
            <ul className="space-y-1">
              {reasons.map((r) => (
                <li key={r} className="flex gap-2 text-muted-foreground">
                  <HandIcon className="mt-0.5 size-4 shrink-0 text-flag" aria-hidden />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="text-muted-foreground tabular-nums">
          {formatCents(spend.amountCents)} + {formatCents(spend.feeCents)} fee ={" "}
          <span className="font-medium text-foreground">{formatCents(total)}</span> from your wallet
        </p>
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button
          variant="outline"
          size="lg"
          className="border-deny/40 text-deny hover:bg-deny-soft hover:text-deny"
          onClick={() => decide("deny")}
          disabled={disabled}
        >
          Deny
        </Button>
        <Button size="lg" onClick={() => decide("approve")} disabled={disabled}>
          Approve
        </Button>
      </CardFooter>
      {outcome && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-card/40">
          <Stamp tone={outcome === "approve" ? "allow" : "deny"} className="text-lg">
            {outcome === "approve" ? "approved" : "denied"}
          </Stamp>
        </div>
      )}
    </Card>
  );
}
