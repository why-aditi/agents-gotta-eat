// Deterministic date formatting: the same string on the server and in the browser, so hydration matches.
// Times are UTC and say so.
const DATE_TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// "2026-10-18T14:03:00.000Z" -> "Oct 18, 2026, 14:03 UTC".
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${DATE_TIME.format(date)} UTC`;
}

// Whole seconds left as "m:ss", or "h:mm:ss" from an hour up.
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.trunc(totalSeconds));
  const hours = Math.trunc(s / 3600);
  const minutes = Math.trunc((s % 3600) / 60);
  const seconds = String(s % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}
