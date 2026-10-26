"use client";

// Add money to the wallet with PayPal. The amount is integer cents; the api checks the minimum and decides what
// PayPal is asked to charge. The wallet only changes when the api says the capture cleared.
import { useId, useRef, useState } from "react";
import { PayPalButton } from "@/components/paypal-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { describePaymentError } from "../_lib/reasons";
import { confirmTopup, createTopup } from "./actions";
import { useAmountKey } from "./use-amount-key";

export const MIN_TOPUP_CENTS = 100;
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
        : null;
  const cents = parsed.ok && parsed.cents >= MIN_TOPUP_CENTS ? parsed.cents : null;

  return (
    <section aria-labelledby={`${uid}-title`} data-testid="topup-card">
      <Card>
        <CardHeader>
          <CardTitle id={`${uid}-title`}>Top up</CardTitle>
          <CardDescription>Add money from PayPal. Minimum {formatCents(MIN_TOPUP_CENTS)}.</CardDescription>
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
          <PayPalButton
            disabled={cents === null}
            createOrder={async () => {
              if (cents === null) return { error: `The minimum top-up is ${formatCents(MIN_TOPUP_CENTS)}.` };
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
