"use client";

// ui-03: a short burst of food when a win lands that this browser hasn't celebrated yet. Remembered per browser, so
// it plays once per win; purely decorative (aria-hidden) and never under reduced motion.
import { useEffect, useState } from "react";

const FOOD = ["🍕", "🍩", "🥐", "🍜", "🍓", "🧁", "🌮", "🍪"] as const;
const PIECES = 18;
const SHOW_MS = 2600;
export const SEEN_KEY = "gottaeat:feast-seen";

function seen(): string | null {
  try {
    return window.localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

function remember(id: string) {
  try {
    window.localStorage.setItem(SEEN_KEY, id);
  } catch {
    // Private mode or blocked storage: it may play again, which is harmless.
  }
}

export function FeastConfetti({ winId }: { winId: string | null }) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!winId || seen() === winId) return;
    remember(winId);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    setPlaying(true);
    const done = setTimeout(() => setPlaying(false), SHOW_MS);
    return () => clearTimeout(done);
  }, [winId]);

  if (!playing) return null;
  return (
    <div aria-hidden data-testid="feast-confetti" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: PIECES }, (_, i) => (
        <span
          key={i}
          className="animate-food-fall absolute top-0 text-2xl"
          style={{
            left: `${(i * 37) % 100}%`,
            animationDelay: `${(i % 6) * 120}ms`,
            animationDuration: `${1600 + ((i * 53) % 900)}ms`,
          }}
        >
          {FOOD[i % FOOD.length]}
        </span>
      ))}
    </div>
  );
}
