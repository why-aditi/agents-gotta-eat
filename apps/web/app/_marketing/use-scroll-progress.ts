"use client";

// mkt-02: how far an element has scrolled through the viewport, 0 to 1, for scroll-driven scenes. 0 when its top
// reaches the top of the viewport, 1 when its bottom reaches the bottom (so a tall section with a sticky stage plays
// end to end while pinned). Read once per frame, passive listeners only: it never blocks or slows scrolling.
// Returns null under reduced motion, or before mount, so callers render their static version.
import { useEffect, useState, type RefObject } from "react";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

export function progressThrough(top: number, height: number, viewport: number): number {
  const travel = height - viewport;
  if (travel <= 0) return top <= 0 ? 1 : 0;
  return Math.min(1, Math.max(0, -top / travel));
}

export function useScrollProgress(ref: RefObject<HTMLElement | null>): number | null {
  const reduced = usePrefersReducedMotion();
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    if (reduced) {
      setProgress(null);
      return;
    }
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setProgress(progressThrough(rect.top, rect.height, window.innerHeight));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref, reduced]);

  return progress;
}
