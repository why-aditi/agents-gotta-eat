"use client";

// Add money to the wallet with PayPal. The owner types the wallet credit; the card shows PayPal's fee and the total
// (integer cents, the same topupFeeCents the api uses). The api checks the limits and decides what PayPal is asked
// to charge. The wallet only changes when the api says the capture cleared.
import { MAX_TOPUP_CENTS, MIN_TOPUP_CENTS, topupFeeCents } from "@gottaeat/schemas";
import { useId, useRef, useState } from "react";
import { PayPalButton } from "@/components/paypal-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { describePaymentError } from "../_lib/reasons";
import { confirmTopup, createTopup } from "./actions";
import { useAmountKey } from "./use-amount-key";

const SETTLING = "PayPal is still settling this payment; your balance updates when it clears.";

export function TopupCard() {
  const uid = useId();
  const [amount, setAmount] = useState("");
  const [settling, setSettling] = useState(false);
  const topupId = useRef<string | null>(null);
  const createKey = useAmountKey();

  const parsed = parseDollarsToCents(amount);
  const error = !amount.trim()
    ? null
    : !parsed.ok
      ? parsed.error
      : parsed.cents < MIN_TOPUP_CENTS
        ? `The minimum top-up is ${formatCents(MIN_TOPUP_CENTS)}.`
        : parsed.cents > MAX_TOPUP_CENTS
          ? `The maximum top-up is ${formatCents(MAX_TOPUP_CENTS)}.`
          : null;
  const cents = parsed.ok && !error ? parsed.cents : null;
  const feeCents = cents === null ? null : topupFeeCents(cents);

  return (
    <section aria-labelledby={`${uid}-title`} data-testid="topup-card">
      <Card>
        <CardHeader>
          <CardTitle id={`${uid}-title`}>Top up</CardTitle>
          <CardDescription>
            Add money from PayPal. Minimum {formatCents(MIN_TOPUP_CENTS)}. PayPal&apos;s fee (3.49% + 49¢) is added on
            top, so your wallet gets the full amount.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${uid}-amount`}>Amount (USD)</Label>
            <Input
              id={`${uid}-amount`}
              inputMode="decimal"
              autoComplete="off"
              placeholder="25.00"
              className="sm:w-40"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setSettling(false);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${uid}-error` : undefined}
            />
            {error ? (
              <p id={`${uid}-error`} className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          {cents !== null && feeCents !== null ? (
            <p className="text-sm tabular-nums text-muted-foreground" data-testid="topup-breakdown">
              Wallet credit {formatCents(cents)} · PayPal fee {formatCents(feeCents)} ·{" "}
              <span className="font-medium text-foreground" data-testid="topup-total">
                You pay {formatCents(cents + feeCents)}
              </span>
            </p>
          ) : null}
          <PayPalButton
            disabled={cents === null}
            createOrder={async () => {
              if (cents === null) return { error: error ?? `The minimum top-up is ${formatCents(MIN_TOPUP_CENTS)}.` };
              const result = await createTopup(cents, createKey.keyFor(cents));
              if (!result.ok) return { error: describePaymentError(result.code, result.message) };
              topupId.current = result.data.topupId;
              return { orderId: result.data.orderId };
            }}
            onApproved={async () => {
              if (!topupId.current) return { ok: false, message: "Couldn't find this top-up. Reload and try again." };
              const result = await confirmTopup(topupId.current, crypto.randomUUID());
              if (!result.ok) return { ok: false, message: describePaymentError(result.code, result.message) };
              createKey.renew();
              if (result.data.status === "captured") {
                setAmount("");
                return { ok: true, message: `Added ${formatCents(result.data.amountCents)} to your wallet.` };
              }
              setSettling(true);
              return { ok: true, message: SETTLING };
            }}
          />
          {settling ? <p className="text-sm text-muted-foreground">{SETTLING}</p> : null}
        </CardContent>
      </Card>
    </section>
  );
}
