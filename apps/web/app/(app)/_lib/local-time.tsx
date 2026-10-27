"use client";

// A time in the reader's own time zone. The server render (and the first browser render) shows UTC, so hydration
// matches; the local time replaces it once mounted.
import { useEffect, useState } from "react";
import { formatDateTime } from "./format";

const LOCAL = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export function formatLocalDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : LOCAL.format(date);
}

export function LocalTime({ iso }: { iso: string }) {
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => setLocal(formatLocalDateTime(iso)), [iso]);
  return <time dateTime={iso}>{local ?? formatDateTime(iso)}</time>;
}
