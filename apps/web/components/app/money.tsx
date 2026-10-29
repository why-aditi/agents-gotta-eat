// ui-02: an amount of money. Integer cents in, tabular figures out; `signed` shows + for money coming in.
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

export function Money({
  cents,
  signed = false,
  tone = "plain",
  className,
}: {
  cents: number;
  signed?: boolean;
  tone?: "plain" | "auto";
  className?: string;
}) {
  const text = signed && cents > 0 ? `+${formatCents(cents)}` : formatCents(cents);
  return (
    <span
      className={cn(
        "font-medium tabular-nums",
        tone === "auto" && cents > 0 && "text-allow",
        tone === "auto" && cents < 0 && "text-foreground",
        className,
      )}
    >
      {text}
    </span>
  );
}
