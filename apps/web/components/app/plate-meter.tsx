// ui-04: how much of today's plate an agent has eaten: today's spend against its daily cap, as a meter and a line.
import { plateLine } from "@/lib/kitchen";
import { cn } from "@/lib/utils";

// Whole percent of the cap used, 0 to 100; null without a cap. Integer maths.
export function capUsedPct(spentCents: number, capCents: number | null): number | null {
  if (capCents === null || capCents <= 0) return null;
  return Math.min(100, Math.floor((spentCents * 100) / capCents));
}

export function PlateMeter({
  name,
  spentCents,
  capCents,
  className,
}: {
  name: string;
  spentCents: number;
  capCents: number | null;
  className?: string;
}) {
  const pct = capUsedPct(spentCents, capCents);
  return (
    <div className={cn("w-full", className)}>
      {pct !== null && (
        <div
          role="meter"
          aria-label={`${name}: today's spend against its daily cap`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="h-2.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn("h-full rounded-full", pct >= 90 ? "bg-deny" : pct >= 70 ? "bg-snack" : "bg-allow")}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">{plateLine(spentCents, capCents)}</p>
    </div>
  );
}
