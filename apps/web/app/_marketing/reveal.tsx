"use client";

// mkt-02: fades and slides its children up as they scroll into view. Visible by default (server render, no
// JavaScript, reduced motion); hidden only after mount while still below the viewport, so nothing on screen flashes.
import { useEffect, useRef, useState, type ReactNode } from "react";

export function Reveal({
  children,
  delayMs = 0,
  className = "",
}: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"static" | "hidden" | "shown">("static");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    setState("hidden");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        setState("shown");
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal={state}
      className={`${state === "static" ? "" : "transition-[opacity,transform] duration-700 ease-out"} ${
        state === "hidden" ? "translate-y-8 opacity-0" : ""
      } ${className}`}
      style={state === "shown" ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
