"use client";

// Re-renders the server page when live events arrive (debounced), with slow polling as a fallback for a dropped
// stream.
import type { ArenaEvent } from "@gottaeat/schemas";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { useEvents } from "@/lib/use-events";

// One router.refresh() at most every `ms`, however many events arrive in between.
export function useDebouncedRefresh(ms = 1000): () => void {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return useCallback(() => {
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      router.refresh();
    }, ms);
  }, [router, ms]);
}

export function LiveRefresh({
  bountyId,
  fallbackMs = 30_000,
  when,
}: {
  bountyId?: string;
  fallbackMs?: number;
  // Which events trigger a refresh; all of them when left out.
  when?: (event: ArenaEvent) => boolean;
}) {
  const router = useRouter();
  const refresh = useDebouncedRefresh(1000);
  const onEvent = useCallback(
    (event: ArenaEvent) => {
      if (!when || when(event)) refresh();
    },
    [when, refresh],
  );
  useEvents({ bountyId, onEvent });

  useEffect(() => {
    if (!fallbackMs) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, fallbackMs);
    return () => clearInterval(timer);
  }, [router, fallbackMs]);
  return null;
}
