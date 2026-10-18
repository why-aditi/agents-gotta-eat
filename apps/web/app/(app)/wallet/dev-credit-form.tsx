"use client";

// Admin-only demo money. The Idempotency-Key is made when the form renders and renewed after each success, so a
// double click credits once.
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { addDevCredit } from "./actions";

export function DevCreditForm({ userId }: { userId: string }) {
  const uid = useId();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [disabledOnApi, setDisabledOnApi] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseDollarsToCents(amount);
    if (!parsed.ok) return setError(parsed.error);
    if (parsed.cents === 0) return setError("Enter an amount above $0.00.");
    setError(null);
    startTransition(async () => {
      const result = await addDevCredit(userId, parsed.cents, key);
      if (result.ok) {
        toast.success(`Added ${formatCents(parsed.cents)}.`);
        setAmount("");
        setKey(crypto.randomUUID());
      } else if (result.code === "not_found") {
        setDisabledOnApi(true);
      } else {
        setError(result.message);
      }
    });
  }

  if (disabledOnApi) {
    return <p className="text-sm text-muted-foreground">Dev credit is turned off on this api.</p>;
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="space-y-2">
        <Label htmlFor={`${uid}-amount`}>Amount ($)</Label>
        <Input
          id={`${uid}-amount`}
          inputMode="decimal"
          autoComplete="off"
          placeholder="50.00"
          className="sm:w-40"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${uid}-error` : undefined}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add credit"}
      </Button>
      {error ? (
        <p id={`${uid}-error`} className="text-sm text-destructive sm:self-center">
          {error}
        </p>
      ) : null}
    </form>
  );
}
