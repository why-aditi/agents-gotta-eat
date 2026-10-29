"use client";

// ui-02: an amount that glows briefly when it changes (a top-up landing, a payout leaving), so the change is noticed.
// The text is always the exact amount: money is never shown at a value it doesn't have, not even mid-animation.
// Reduced motion turns the glow off.
import { useEffect, useRef, useState } from "react";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

export function AnimatedMoney({
  cents,
  className,
  ...rest
}: { cents: number; className?: string } & Record<`data-${string}`, string>) {
  const previous = useRef(cents);
  // Bumped on every change; as the key it restarts the glow animation.
  const [changes, setChanges] = useState(0);

  useEffect(() => {
    if (previous.current === cents) return;
    previous.current = cents;
    setChanges((n) => n + 1);
  }, [cents]);

  return (
    <span
      key={changes}
      data-changed={changes > 0 ? "true" : undefined}
      className={cn("tabular-nums", changes > 0 && "motion-safe:animate-money-glow", className)}
      {...rest}
    >
      {formatCents(cents)}
    </span>
  );
}
