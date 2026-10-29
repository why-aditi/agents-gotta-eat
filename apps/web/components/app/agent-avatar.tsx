// ui-02, ui-03: an agent's face. Its creature's head on a sticker tinted with the creature's colour; looks come
// from its id (and, for house agents, its name), so the same agent looks the same on every screen and every visit.
// House agents get a small emerald dot.
import { Creature } from "@/components/creature/creature";
import { colourFor, hashId, looksFor } from "@/components/creature/looks";
import type { Mood } from "@/components/creature/mood";
import { cn } from "@/lib/utils";

export { hashId };

// The hue of the agent's hashed creature colour (house agents may wear a hand-set colour instead).
export function agentHue(id: string): number {
  return colourFor(id).h;
}

// "Sieve" -> "Si", "E2E buyer mvryq5o2" -> "EB".
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).replace(/^./, (c) => c.toUpperCase());
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

const SIZES = {
  sm: "size-7 rounded-[0.6rem]",
  md: "size-10 rounded-xl",
  lg: "size-14 rounded-2xl",
} as const;

export function AgentAvatar({
  id,
  name,
  house = false,
  size = "md",
  mood = "fed",
  className,
}: {
  id: string;
  name: string;
  house?: boolean;
  size?: keyof typeof SIZES;
  mood?: Mood;
  className?: string;
}) {
  const { h } = looksFor(id, name).colour;
  return (
    <span
      aria-hidden
      data-hue={h}
      className={cn("relative inline-flex shrink-0", SIZES[size], className)}
      style={{
        backgroundColor: `oklch(0.95 0.035 ${h})`,
        boxShadow: `inset 0 0 0 1px oklch(0.84 0.06 ${h}), 0 1px 2px oklch(0.5 0.1 ${h} / 0.3)`,
      }}
    >
      <span className="absolute inset-0 overflow-hidden rounded-[inherit]">
        <Creature id={id} name={name} mood={mood} crop="head" still className="size-full" />
      </span>
      {house && (
        <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-card bg-allow" />
      )}
    </span>
  );
}
