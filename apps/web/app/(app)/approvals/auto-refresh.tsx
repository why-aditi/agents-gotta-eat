"use client";

// Re-renders the server page every few seconds so new requests show up without a reload.
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AutoRefresh({ intervalMs = 10_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);
  return null;
}
