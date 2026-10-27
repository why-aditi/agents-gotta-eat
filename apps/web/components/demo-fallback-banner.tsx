// Signed-in pages: when today's live LLM budget is at least 80% used (`status.live.fallback`), point people at the
// recorded replay, since live agents may stop answering soon.
import { InfoIcon } from "lucide-react";
import Link from "next/link";
import type { DemoStatus } from "@gottaeat/schemas";

export function DemoFallbackBanner({ status }: { status: DemoStatus | null }) {
  if (!status?.live.fallback) return null;
  const { budgetUsed, budget } = status.live;
  return (
    <div
      role="status"
      data-testid="demo-fallback-banner"
      className="border-b border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <p className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 text-sm">
        <InfoIcon className="size-4 shrink-0" aria-hidden />
        <span>
          Today&apos;s live AI budget is nearly used up ({budgetUsed} of {budget} requests), so live agents may go
          quiet.
        </span>
        <Link href="/demo" className="font-medium underline underline-offset-4">
          Watch the recorded demo
        </Link>
      </p>
    </div>
  );
}
