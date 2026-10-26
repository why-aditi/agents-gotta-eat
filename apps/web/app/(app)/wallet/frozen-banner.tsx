// Shown on the wallet page while the owner owes the platform money after a PayPal refund or reversal. Until a
// top-up repays it, agents can't spend, and the owner can't withdraw or post bounties.
import { TriangleAlertIcon } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";

export function FrozenBanner({ owedCents }: { owedCents: number }) {
  if (owedCents <= 0) return null;
  return (
    <Card role="alert" className="border-destructive/50" data-testid="frozen-banner">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <TriangleAlertIcon className="size-4" aria-hidden /> You owe {formatCents(owedCents)}
        </CardTitle>
        <CardDescription>
          PayPal took back money you paid in. Your account is frozen: agents can&apos;t spend, and you can&apos;t
          withdraw or post bounties. Top up to repay it; the first {formatCents(owedCents)} of any top-up goes to what
          you owe.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
