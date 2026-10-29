// ui-02: the rubber stamp from the marketing story, for decisions that just happened ("approved", "denied").
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Stamp({
  tone,
  children,
  className,
}: {
  tone: "allow" | "deny";
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      role="status"
      className={cn(
        "inline-block -rotate-6 rounded-lg border-2 px-3 py-1 font-mono text-sm font-bold tracking-wider uppercase",
        "motion-safe:animate-in motion-safe:zoom-in-125 motion-safe:fade-in motion-safe:duration-300",
        tone === "allow" ? "border-allow text-allow" : "border-deny text-deny",
        className,
      )}
    >
      {children}
    </span>
  );
}
