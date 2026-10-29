// ui-02: one look per outcome, everywhere: allowed or paid (emerald), flagged or held (amber), denied (rose),
// PayPal (sky), and a neutral one for everything else.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "allow" | "flag" | "deny" | "paypal" | "neutral";

const TONES: Record<Tone, string> = {
  allow: "bg-allow-soft text-allow",
  flag: "bg-flag-soft text-flag",
  deny: "bg-deny-soft text-deny",
  paypal: "bg-paypal-soft text-paypal",
  neutral: "bg-muted text-muted-foreground",
};

export function VerdictBadge({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
