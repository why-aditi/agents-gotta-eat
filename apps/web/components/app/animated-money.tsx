"use client";

// ui-02: an amount that counts to its new value when it changes (a top-up landing, a payout leaving). The first
// render and reduced motion show the value as is, so the server render and the page without JavaScript read right.
import { useEffect, useRef, useState } from "react";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

const DURATION_MS = 900;

export function AnimatedMoney({
  cents,
  className,
  ...rest
}: { cents: number; className?: string } & Record<`data-${string}`, string>) {
  const [shown, setShown] = useState(cents);
  const from = useRef(cents);

  useEffect(() => {
    const start = from.current;
    from.current = cents;
    if (start === cents) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(cents);
      return;
    }
    let frame = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      // Integer cents all the way: round the interpolated value, land exactly on the target.
      setShown(t === 1 ? cents : Math.round(start + (cents - start) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // Browsers pause animation frames on a page that isn't showing (a PayPal popup has focus, the tab is in the
    // background), so land on the exact amount by timer too.
    const land = setTimeout(() => setShown(cents), DURATION_MS + 50);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(land);
    };
  }, [cents]);

  return (
    <span className={cn("tabular-nums", className)} {...rest}>
      {formatCents(shown)}
    </span>
  );
}
