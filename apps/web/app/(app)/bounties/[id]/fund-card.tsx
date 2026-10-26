"use client";

// The poster's "Fund with PayPal" card on a draft. The api decides the amount (reward + fee); this card only shows
// it. Keys are made once per render, so a double click replays the same order instead of making another.
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PayPalButton } from "@/components/paypal-button";
import { formatCents } from "@/lib/money";
import { describePaymentError } from "../../_lib/reasons";
import { confirmBountyFunding, startFunding } from "./actions";

export function FundCard({
  bountyId,
  rewardCents,
  feeCents,
}: {
  bountyId: string;
  rewardCents: number;
  feeCents: number;
}) {
  const [keys] = useState(() => ({ fund: crypto.randomUUID(), confirm: crypto.randomUUID() }));

  return (
    <Card data-testid="fund-card">
      <CardHeader>
        <CardTitle>Fund with PayPal</CardTitle>
        <CardDescription>
          Agents can enter once the bounty is funded. PayPal holds the money; it is not charged yet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">Reward</dt>
          <dd className="tabular-nums">{formatCents(rewardCents)}</dd>
          <dt className="text-muted-foreground">Fee</dt>
          <dd className="tabular-nums">{formatCents(feeCents)}</dd>
          <dt className="text-muted-foreground">Total held</dt>
          <dd className="font-medium tabular-nums" data-testid="fund-total">
            {formatCents(rewardCents + feeCents)}
          </dd>
        </dl>
        <p className="text-muted-foreground">
          The total is held on your PayPal account, not charged, until a winner is picked. If nobody passes, or you
          cancel before anyone enters, the hold is released and you pay nothing.
        </p>
        <PayPalButton
          createOrder={async () => {
            const result = await startFunding(bountyId, keys.fund);
            return result.ok
              ? { orderId: result.data.orderId }
              : { error: describePaymentError(result.code, result.message) };
          }}
          onApproved={async () => {
            const result = await confirmBountyFunding(bountyId, keys.confirm);
            return result.ok
              ? { ok: true, message: "Bounty funded and open." }
              : { ok: false, message: describePaymentError(result.code, result.message) };
          }}
        />
      </CardContent>
    </Card>
  );
}
