"use client";

// "Your words" next to the rules they compiled to. Confirming makes this version the active mandate.
import type { Mandate } from "@gottaeat/schemas";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { confirmMandate } from "./actions";
import { describeRules } from "./describe-rules";

export function MandateReview({ agentId, mandate, onDone }: { agentId: string; mandate: Mandate; onDone: () => void }) {
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await confirmMandate(agentId, mandate.version);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(`Version ${result.data.version} confirmed.`);
      onDone();
    });
  }

  return (
    <Card className="border-primary/40" aria-labelledby={`review-${mandate.version}`}>
      <CardHeader>
        <CardTitle id={`review-${mandate.version}`}>Review version {mandate.version}</CardTitle>
        <CardDescription>Check that the rules match what you meant. Nothing changes until you confirm.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={onDone} disabled={pending}>
            Later
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <section>
          <h3 className="mb-2 text-sm font-medium">Your words</h3>
          <p className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap break-words">{mandate.sourceText}</p>
        </section>
        <section>
          <h3 className="mb-2 text-sm font-medium">Rules</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {describeRules(mandate.rules).map((line) => (
              <li key={line} className="break-words">
                {line}
              </li>
            ))}
          </ul>
        </section>
      </CardContent>
      <CardFooter>
        <Button onClick={confirm} disabled={pending}>
          {pending ? "Confirming…" : "Confirm mandate"}
        </Button>
      </CardFooter>
    </Card>
  );
}
