"use client";

// ui-02: "2 min ago", "in 14 min". The server render shows the UTC date (deterministic, so hydration matches); the
// relative text replaces it once mounted and keeps itself fresh. The full local time is in the tooltip.
import { useEffect, useState } from "react";
import { formatDateTime } from "@/app/(app)/_lib/format";
import { formatLocalDateTime } from "@/app/(app)/_lib/local-time";

const RTF = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });

export function relativeTime(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const s = Math.round((t - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 45) return s <= 0 ? "just now" : "in a moment";
  if (abs < 3600) return RTF.format(Math.round(s / 60), "minute");
  if (abs < 86_400) return RTF.format(Math.round(s / 3600), "hour");
  if (abs < 7 * 86_400) return RTF.format(Math.round(s / 86_400), "day");
  return formatLocalDateTime(iso);
}

export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <time dateTime={iso} title={now === null ? undefined : formatLocalDateTime(iso)} className={className}>
      {now === null ? formatDateTime(iso) : relativeTime(iso, now)}
    </time>
  );
}
