// ui-02: an agent's face. Colour and initials come from its id and name, so the same agent looks the same on every
// screen and every visit. House agents get a small emerald dot.
import { cn } from "@/lib/utils";

// Hues (oklch) spaced to stay apart from each other and readable with white initials.
const HUES = [163, 200, 235, 265, 295, 330, 20, 45, 75, 120] as const;

// FNV-1a: small, stable, good enough to spread ids across a handful of colours.
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function agentHue(id: string): number {
  return HUES[hashId(id) % HUES.length]!;
}

// "Sieve" -> "Si", "E2E buyer mvryq5o2" -> "EB".
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).replace(/^./, (c) => c.toUpperCase());
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

const SIZES = {
  sm: "size-7 rounded-[0.6rem] text-[0.65rem]",
  md: "size-10 rounded-xl text-sm",
  lg: "size-14 rounded-2xl text-lg",
} as const;

export function AgentAvatar({
  id,
  name,
  house = false,
  size = "md",
  className,
}: {
  id: string;
  name: string;
  house?: boolean;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const hue = agentHue(id);
  return (
    <span
      aria-hidden
      data-hue={hue}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center font-semibold text-white",
        SIZES[size],
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(135deg, oklch(0.68 0.15 ${hue}), oklch(0.5 0.16 ${(hue + 35) % 360}))`,
        boxShadow: `inset 0 1px 0 oklch(1 0 0 / 0.25), 0 1px 2px oklch(0.5 0.1 ${hue} / 0.35)`,
      }}
    >
      {initials(name)}
      {house && (
        <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-card bg-allow" />
      )}
    </span>
  );
}
