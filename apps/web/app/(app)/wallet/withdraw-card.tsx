"use client";

// Withdraw wallet money to a PayPal email. The api holds the amount at once and sends it through PayPal Payouts;
// the status below comes from PayPal's webhooks, so a new withdrawal starts as "pending". The Idempotency-Key
// stays the same for the same amount, so a double click withdraws once.
import type { Payout } from "@gottaeat/schemas";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { formatDateTime } from "../_lib/format";
import { describePaymentError, PAYOUT_STATUS_LABEL } from "../_lib/reasons";
import { requestWithdrawal, savePayoutEmail } from "./actions";
import { useAmountKey } from "./use-amount-key";

export const MIN_WITHDRAWAL_CENTS = 500;

function StatusBadge({ status }: { status: Payout["status"] }) {
  const variant =
    status === "succeeded" ? "default" : status === "pending" || status === "unclaimed" ? "secondary" : "outline";
  return <Badge variant={variant}>{PAYOUT_STATUS_LABEL[status]}</Badge>;
}

export function WithdrawalList({ payouts }: { payouts: Payout[] }) {
  if (payouts.length === 0) return <p className="text-sm text-muted-foreground">No withdrawals yet.</p>;
  return (
    <ul className="divide-y rounded-md border text-sm" aria-label="Recent withdrawals">
      {payouts.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <span className="tabular-nums">{formatCents(p.amountCents)}</span>
          <span className="text-muted-foreground">{formatDateTime(p.createdAt)}</span>
          <StatusBadge status={p.status} />
        </li>
      ))}
    </ul>
  );
}

export function WithdrawCard({ payoutEmail, payouts }: { payoutEmail: string | null; payouts: Payout[] }) {
  const uid = useId();
  const router = useRouter();
  const [emailInput, setEmailInput] = useState(payoutEmail ?? "");
  const [savedEmail, setSavedEmail] = useState(payoutEmail);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const key = useAmountKey();
  const [savingEmail, startEmail] = useTransition();
  const [withdrawing, startWithdraw] = useTransition();

  function onSaveEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError(null);
    startEmail(async () => {
      const result = await savePayoutEmail(emailInput);
      if (result.ok) {
        setSavedEmail(result.data.email);
        toast.success("PayPal email saved.");
        router.refresh();
      } else {
        // A 409 (a withdrawal is in flight) carries the api's own explanation.
        setEmailError(result.message);
      }
    });
  }

  function onWithdraw(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseDollarsToCents(amount);
    if (!parsed.ok) return setAmountError(parsed.error);
    if (parsed.cents < MIN_WITHDRAWAL_CENTS) {
      return setAmountError(`The minimum withdrawal is ${formatCents(MIN_WITHDRAWAL_CENTS)}.`);
    }
    setAmountError(null);
    startWithdraw(async () => {
      const result = await requestWithdrawal(parsed.cents, key.keyFor(parsed.cents));
      if (result.ok) {
        key.renew();
        setAmount("");
        toast.success(
          `Withdrawal of ${formatCents(result.data.amountCents)} requested. It stays pending until PayPal confirms.`,
        );
        router.refresh();
      } else {
        setAmountError(describePaymentError(result.code, result.message));
      }
    });
  }

  return (
    <section aria-labelledby={`${uid}-title`} data-testid="withdraw-card">
      <Card>
        <CardHeader>
          <CardTitle id={`${uid}-title`}>Withdraw</CardTitle>
          <CardDescription>
            Send wallet money to your PayPal account. Minimum {formatCents(MIN_WITHDRAWAL_CENTS)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <form onSubmit={onSaveEmail} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-2">
                <Label htmlFor={`${uid}-email`}>PayPal email</Label>
                <Input
                  id={`${uid}-email`}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="sm:w-72"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    setEmailError(null);
                  }}
                  aria-invalid={emailError ? true : undefined}
                  aria-describedby={emailError ? `${uid}-email-error` : undefined}
                />
              </div>
              <Button type="submit" variant="outline" disabled={savingEmail || !emailInput.trim()}>
                {savingEmail ? "Saving…" : "Save email"}
              </Button>
            </form>
            {emailError ? (
              <p id={`${uid}-email-error`} role="alert" className="text-sm text-destructive">
                {emailError}
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground" data-testid="saved-email">
              {savedEmail ? `Withdrawals go to ${savedEmail}.` : "No PayPal email saved yet."}
            </p>
          </div>

          <div className="space-y-2">
            <form onSubmit={onWithdraw} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-2">
                <Label htmlFor={`${uid}-amount`}>Amount (USD)</Label>
                <Input
                  id={`${uid}-amount`}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="20.00"
                  className="sm:w-40"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setAmountError(null);
                  }}
                  aria-invalid={amountError ? true : undefined}
                  aria-describedby={amountError ? `${uid}-amount-error` : undefined}
                />
              </div>
              <Button type="submit" disabled={withdrawing || !savedEmail}>
                {withdrawing ? "Withdrawing…" : "Withdraw"}
              </Button>
            </form>
            {amountError ? (
              <p id={`${uid}-amount-error`} role="alert" className="text-sm text-destructive">
                {amountError}
              </p>
            ) : null}
            {!savedEmail ? (
              <p className="text-sm text-muted-foreground">Save a PayPal email above to turn on withdrawals.</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Recent withdrawals</h3>
            <WithdrawalList payouts={payouts} />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
