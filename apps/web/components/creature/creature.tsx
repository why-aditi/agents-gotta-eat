// ui-03: an agent as a little creature. Looks come from the agent id (see looks.ts), the face from its mood. Inline
// SVG only, so it renders on the server and the agent's name never becomes markup. Motion is CSS: an idle bob, a
// blink, and one-shot cheer and sulk reactions, all behind motion-safe so reduced motion keeps it still.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { type Accessory, type Colour, type Eyes, fill, hashId, looksFor, type Looks, type Shape } from "./looks";
import type { Mood } from "./mood";

const INK = "oklch(0.25 0.03 50)";
const MOUTH = "oklch(0.32 0.09 20)";
const TONGUE = "oklch(0.7 0.16 12)";
const BLUSH = "oklch(0.72 0.17 12 / 0.5)";
const OUTLINE = 3;
const LINE = 2.4;

const SIZES = {
  sm: "size-7",
  md: "size-16",
  lg: "size-30",
  xl: "size-45",
} as const;

const BADGES = {
  sm: "size-2.5",
  md: "size-3",
  lg: "size-4",
  xl: "size-5",
} as const;

// The whole creature, or a head-and-shoulders crop for avatars.
const VIEW_BOXES = { full: "0 0 100 100", head: "12 10 76 76" } as const;

// Body outline plus where the face and accessories sit on it: `top` is the top of the head at x = 50, `halfW` the
// half-width at eye height.
const BODIES: Record<Shape, { d: string; top: number; eyeY: number; eyeDx: number; mouthY: number; halfW: number }> = {
  round: {
    d: "M50 26C68 26 82 40 82 58C82 76 68 90 50 90C32 90 18 76 18 58C18 40 32 26 50 26Z",
    top: 26,
    eyeY: 54,
    eyeDx: 11,
    mouthY: 66,
    halfW: 31,
  },
  bean: {
    d: "M50 22C66 22 76 36 76 54C76 76 66 90 50 90C34 90 24 76 24 54C24 36 34 22 50 22Z",
    top: 22,
    eyeY: 50,
    eyeDx: 10,
    mouthY: 62,
    halfW: 26,
  },
  blob: {
    d: "M50 25C62 23 74 30 79 42C85 55 84 70 76 80C68 89 58 91 48 90C36 89 24 84 19 72C14 60 17 44 26 35C33 28 41 26 50 25Z",
    top: 25,
    eyeY: 53,
    eyeDx: 11,
    mouthY: 65,
    halfW: 31,
  },
  tooth: {
    d: "M30 26H70Q82 26 82 38V74Q82 90 72 90Q64 90 62 84Q58 79 50 79Q42 79 38 84Q36 90 28 90Q18 90 18 74V38Q18 26 30 26Z",
    top: 26,
    eyeY: 49,
    eyeDx: 12,
    mouthY: 61,
    halfW: 32,
  },
  pear: {
    d: "M50 24C60 24 66 32 67 42C68 50 82 58 82 72C82 84 68 91 50 91C32 91 18 84 18 72C18 58 32 50 33 42C34 32 40 24 50 24Z",
    top: 24,
    eyeY: 52,
    eyeDx: 10,
    mouthY: 65,
    halfW: 22,
  },
  gumdrop: {
    d: "M50 24C70 24 80 42 81 62C82 76 82 88 72 89H28C18 88 18 76 19 62C20 42 30 24 50 24Z",
    top: 24,
    eyeY: 54,
    eyeDx: 11,
    mouthY: 66,
    halfW: 30,
  },
};

type Body = (typeof BODIES)[Shape];

// Hats, bows and headphones take the opposite hue to the body so they never vanish into it.
function accent({ h }: Colour, l = 0.72): string {
  return `oklch(${l} 0.15 ${(h + 180) % 360})`;
}

export function Creature({
  id,
  name,
  mood = "fed",
  size = "md",
  house = false,
  reaction,
  still = false,
  crop = "full",
  className,
  title,
}: {
  id: string;
  name: string;
  mood?: Mood;
  size?: keyof typeof SIZES;
  house?: boolean;
  // A one-shot reaction; change the element's key to play it again.
  reaction?: "cheer" | "sulk";
  // No idle bob (avatars in lists). Blinking stays.
  still?: boolean;
  crop?: keyof typeof VIEW_BOXES;
  className?: string;
  title?: string;
}) {
  const looks = looksFor(id, name);
  const body = BODIES[looks.shape];
  // Spread the loops per agent so a list of creatures doesn't bob and blink in unison.
  const delay = `-${hashId(id) % 5000}ms`;
  const a11y = title ? { role: "img", "aria-label": title } : { "aria-hidden": true };

  return (
    <span
      {...a11y}
      data-mood={mood}
      data-shape={looks.shape}
      data-colour={looks.colour.name}
      data-eyes={looks.eyes}
      data-accessory={looks.accessory}
      data-reaction={reaction}
      className={cn("relative inline-block shrink-0", SIZES[size], className)}
    >
      <svg viewBox={VIEW_BOXES[crop]} aria-hidden focusable="false" className="block size-full">
        {crop === "full" && <ellipse cx="50" cy="94" rx="25" ry="3" fill={INK} opacity="0.12" />}
        <g
          className={cn(
            "origin-bottom [transform-box:fill-box]",
            reaction === "cheer" && "motion-safe:animate-creature-cheer",
            reaction === "sulk" && "motion-safe:animate-creature-sulk",
          )}
        >
          <g
            className={cn(!still && "origin-bottom [transform-box:fill-box] motion-safe:animate-creature-bob")}
            style={still ? undefined : { animationDelay: delay }}
          >
            {looks.accessory === "headphones" && <HeadphoneBand body={body} colour={looks.colour} />}
            <path d={body.d} fill={fill(looks.colour)} stroke={INK} strokeWidth={OUTLINE} strokeLinejoin="round" />
            <Shine body={body} />
            <Cheeks looks={looks} body={body} />
            <Face looks={looks} body={body} mood={mood} delay={delay} />
            <AccessoryArt accessory={looks.accessory} body={body} colour={looks.colour} />
          </g>
        </g>
        <MoodExtras mood={mood} body={body} />
      </svg>
      {house && (
        <span className={cn("absolute right-0 bottom-0 rounded-full border-2 border-card bg-allow", BADGES[size])} />
      )}
    </span>
  );
}

function at(x: number, y: number, children: ReactNode, extra = "") {
  return <g transform={`translate(${x} ${y})${extra}`}>{children}</g>;
}

function Shine({ body }: { body: Body }) {
  const x = 50 - body.halfW * 0.5;
  const y = body.top + 11;
  return (
    <g fill="white">
      <ellipse cx={x} cy={y} rx="7" ry="4" opacity="0.55" transform={`rotate(-35 ${x} ${y})`} />
      <circle cx={x + 7} cy={y - 4} r="1.6" opacity="0.7" />
    </g>
  );
}

function Cheeks({ looks, body }: { looks: Looks; body: Body }) {
  if (looks.cheeks === "none") return null;
  const dx = body.eyeDx + 7;
  const y = body.eyeY + 7;
  return (
    <g>
      {[50 - dx, 50 + dx].map((x) =>
        looks.cheeks === "blush" ? (
          <ellipse key={x} cx={x} cy={y} rx="4.5" ry="2.8" fill={BLUSH} />
        ) : (
          <g key={x} fill="oklch(0.45 0.08 40 / 0.55)">
            <circle cx={x - 2.2} cy={y - 0.6} r="0.95" />
            <circle cx={x + 2.2} cy={y - 0.6} r="0.95" />
            <circle cx={x} cy={y + 1.4} r="0.95" />
          </g>
        ),
      )}
    </g>
  );
}

function Face({ looks, body, mood, delay }: { looks: Looks; body: Body; mood: Mood; delay: string }) {
  const left = 50 - body.eyeDx;
  const right = 50 + body.eyeDx;
  const closed = mood === "sleeping" || mood === "feasting";
  const glasses = looks.accessory === "glasses";
  return (
    <g>
      <g
        className={cn(!closed && "origin-center [transform-box:fill-box] motion-safe:animate-creature-blink")}
        style={closed ? undefined : { animationDelay: delay }}
      >
        {at(left, body.eyeY, <Eye kind={looks.eyes} mood={mood} colour={looks.colour} />)}
        {at(right, body.eyeY, <Eye kind={looks.eyes} mood={mood} colour={looks.colour} />)}
      </g>
      {mood === "sulking" && (
        <g stroke={INK} strokeWidth={LINE + 0.4} strokeLinecap="round">
          {/* Furrowed: the inner ends dip toward the nose. */}
          {at(left, body.eyeY - (glasses ? 3 : 0), <path d="M-5 -10L4 -6.5" />)}
          {at(right, body.eyeY - (glasses ? 3 : 0), <path d="M5 -10L-4 -6.5" />)}
        </g>
      )}
      {glasses && (
        <g stroke={INK} strokeWidth={LINE} fill="none">
          <circle cx={left} cy={body.eyeY} r="7.5" fill="oklch(1 0 0 / 0.3)" />
          <circle cx={right} cy={body.eyeY} r="7.5" fill="oklch(1 0 0 / 0.3)" />
          <path d={`M${left + 7.5} ${body.eyeY}Q50 ${body.eyeY - 3} ${right - 7.5} ${body.eyeY}`} />
          <path d={`M${left - 7.5} ${body.eyeY - 1}L${50 - body.halfW + 1} ${body.eyeY - 3}`} />
          <path d={`M${right + 7.5} ${body.eyeY - 1}L${50 + body.halfW - 1} ${body.eyeY - 3}`} />
        </g>
      )}
      {at(50, body.mouthY, <Mouth mood={mood} />)}
      {mood === "begging" && <Paws body={body} colour={looks.colour} />}
    </g>
  );
}

function Eye({ kind, mood, colour }: { kind: Eyes; mood: Mood; colour: Colour }) {
  const stroke = {
    stroke: INK,
    strokeWidth: LINE,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    fill: "none",
  } as const;
  if (mood === "sleeping") return <path d="M-4 -1Q0 3 4 -1" {...stroke} />;
  if (mood === "feasting") return <path d="M-4 2L0 -2.5L4 2" {...stroke} />;
  if (mood === "begging") {
    // Big shiny puppy eyes, whatever the usual eyes are.
    return (
      <g>
        <circle r="5.6" fill={INK} />
        <circle cx="-1.7" cy="-1.9" r="2.2" fill="white" />
        <circle cx="1.9" cy="1.7" r="1" fill="white" />
      </g>
    );
  }
  switch (kind) {
    case "dots":
      return (
        <g>
          <circle r="3.3" fill={INK} />
          <circle cx="-1" cy="-1.1" r="1" fill="white" />
        </g>
      );
    case "ovals":
      return (
        <g>
          <ellipse rx="2.7" ry="4.2" fill={INK} />
          <ellipse cx="-0.8" cy="-1.6" rx="0.9" ry="1.3" fill="white" />
        </g>
      );
    case "sleepy":
      // A dot with a heavy lid: the top half is covered in body colour.
      return (
        <g>
          <circle cy="0.6" r="3.4" fill={INK} />
          <path d="M-4.6 0.4A4.6 4.6 0 0 1 4.6 0.4Z" fill={fill(colour)} />
          <path d="M-4.6 0.4H4.6" {...stroke} />
        </g>
      );
    case "wide":
      return (
        <g>
          <circle r="5" fill="white" stroke={INK} strokeWidth={LINE - 0.4} />
          <circle cx="0.5" cy="0.6" r="2.6" fill={INK} />
          <circle cx="-0.3" cy="-0.4" r="0.8" fill="white" />
        </g>
      );
    case "buttons":
      return (
        <g>
          <circle r="4.2" fill={INK} />
          <circle cx="-1.4" cy="-1.5" r="1.4" fill="white" />
          <circle cx="1.6" cy="1.5" r="0.7" fill="white" />
        </g>
      );
    case "shifty":
      // Half-lidded, both pupils slid to the same side.
      return (
        <g>
          <path d="M-5 0A5 4.4 0 0 0 5 0Z" fill="white" stroke={INK} strokeWidth={LINE - 0.4} />
          <circle cx="2.5" cy="1.6" r="1.9" fill={INK} />
          <path d="M-5.8 0H5.8" {...stroke} strokeWidth={LINE + 0.4} />
        </g>
      );
  }
}

function Mouth({ mood }: { mood: Mood }) {
  const line = {
    stroke: INK,
    strokeWidth: LINE,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    fill: "none",
  } as const;
  switch (mood) {
    case "fed":
      return <path d="M-6 -1Q0 5 6 -1" {...line} />;
    case "peckish":
      return <ellipse cy="1" rx="2.6" ry="3.2" fill={MOUTH} stroke={INK} strokeWidth={LINE - 0.4} />;
    case "hungry":
      return (
        <g>
          <path d="M-8 -2Q0 -4 8 -2Q7 10 0 10Q-7 10 -8 -2Z" fill={MOUTH} stroke={INK} strokeWidth={LINE - 0.2} />
          <path d="M-4.5 7.6Q0 3.8 4.5 7.6Q2.5 9.6 0 9.6Q-2.5 9.6 -4.5 7.6Z" fill={TONGUE} />
          {/* A drool drop at the corner. */}
          <path
            d="M7 6C8.6 8.6 9.8 10.4 9.8 11.8A2.8 2.8 0 0 1 4.2 11.8C4.2 10.4 5.4 8.6 7 6Z"
            fill="oklch(0.9 0.06 225)"
            stroke={INK}
            strokeWidth="1.4"
          />
        </g>
      );
    case "begging":
      return <path d="M-4.5 1Q-2.25 -1.5 0 1Q2.25 3.5 4.5 1" {...line} />;
    case "sulking":
      return <path d="M-5.5 3Q0 -2.5 5.5 3" {...line} />;
    case "feasting":
      return (
        <g>
          <path d="M-10 -2Q0 0 10 -2Q8 10 0 10Q-8 10 -10 -2Z" fill={MOUTH} stroke={INK} strokeWidth={LINE - 0.2} />
          <path d="M-4.8 7.8Q0 4 4.8 7.8Q2.6 9.7 0 9.7Q-2.6 9.7 -4.8 7.8Z" fill={TONGUE} />
          <path d="M-8.4 -0.9Q0 0.9 8.4 -0.9L7.9 1.3Q0 3 -7.9 1.3Z" fill="white" />
        </g>
      );
    case "sleeping":
      return <path d="M-2.5 0.5Q0 2.5 2.5 0.5" {...line} />;
  }
}

// Two little paws pressed together under the chin, like asking nicely.
function Paws({ body, colour }: { body: Body; colour: Colour }) {
  const y = body.mouthY + 14;
  return (
    <g fill={fill(colour)} stroke={INK} strokeWidth={LINE - 0.2}>
      <ellipse cx="45.5" cy={y} rx="4.8" ry="6" transform={`rotate(-14 45.5 ${y})`} />
      <ellipse cx="54.5" cy={y} rx="4.8" ry="6" transform={`rotate(14 54.5 ${y})`} />
    </g>
  );
}

// Drawn behind the body so the band disappears over the head.
function HeadphoneBand({ body, colour }: { body: Body; colour: Colour }) {
  const l = 50 - body.halfW + 2;
  const r = 50 + body.halfW - 2;
  const d = `M${l} ${body.eyeY - 6}C${l} ${body.top - 14} ${r} ${body.top - 14} ${r} ${body.eyeY - 6}`;
  return (
    <g fill="none" strokeLinecap="round">
      <path d={d} stroke={INK} strokeWidth="6.5" />
      <path d={d} stroke={accent(colour)} strokeWidth="3" />
    </g>
  );
}

function AccessoryArt({ accessory, body, colour }: { accessory: Accessory; body: Body; colour: Colour }) {
  const ink = { stroke: INK, strokeWidth: LINE - 0.2, strokeLinejoin: "round" } as const;
  const { top } = body;
  switch (accessory) {
    case "none":
    case "glasses":
      return null;
    case "antenna":
      return (
        <g>
          <path d={`M50 ${top + 1}Q46 ${top - 6} 50 ${top - 11}`} fill="none" {...ink} strokeLinecap="round" />
          <circle cx="50" cy={top - 14} r="4" fill={accent(colour)} {...ink} />
          <circle cx="48.6" cy={top - 15.4} r="1.1" fill="white" />
        </g>
      );
    case "hat":
      // A party hat with a pompom, tipped to one side.
      return at(
        52,
        top + 3,
        <g>
          <path d="M-9 0L0 -19L9 0Q0 3 -9 0Z" fill={accent(colour)} {...ink} />
          <path d="M-5.6 -7L4.4 -9.6M-3 -12.6L2.2 -14" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <circle cy="-20" r="3.2" fill="white" {...ink} />
        </g>,
        " rotate(-12)",
      );
    case "sprout":
      return (
        <g>
          <path d={`M50 ${top + 1}Q49 ${top - 5} 51 ${top - 9}`} fill="none" {...ink} strokeLinecap="round" />
          {at(
            51,
            top - 9,
            <g fill="oklch(0.74 0.17 142)" {...ink}>
              <path d="M0 0C-3 -6 -10 -7 -13 -3C-9 1 -4 2 0 0Z" />
              <path d="M0 0C2 -5 7 -7 10 -5C8 -1 4 1 0 0Z" />
            </g>,
          )}
        </g>
      );
    case "bow":
      return at(
        61,
        top + 4,
        <g fill={accent(colour)} {...ink}>
          <path d="M0 0C-3 -6 -10 -7 -10 0C-10 7 -3 6 0 0Z" />
          <path d="M0 0C3 -6 10 -7 10 0C10 7 3 6 0 0Z" />
          <circle r="2.8" />
        </g>,
        " rotate(18)",
      );
    case "headphones":
      return (
        <g fill={accent(colour)} {...ink}>
          <rect x={50 - body.halfW - 4} y={body.eyeY - 13} width="8.5" height="15" rx="3.6" />
          <rect x={50 + body.halfW - 4.5} y={body.eyeY - 13} width="8.5" height="15" rx="3.6" />
        </g>
      );
    case "explorer-hat":
      // A pith helmet: dome, band, brim.
      return at(
        50,
        top + 5,
        <g {...ink}>
          <path d="M-16 0C-16 -18 16 -18 16 0Z" fill="oklch(0.84 0.08 88)" />
          <path d="M-15.6 -2.5H15.6V0H-15.6Z" fill="oklch(0.58 0.09 60)" />
          <ellipse cy="0.6" rx="22" ry="3.6" fill="oklch(0.84 0.08 88)" />
          <circle cy="-13.4" r="1.8" fill="oklch(0.58 0.09 60)" />
        </g>,
        " rotate(-8)",
      );
    case "top-hat":
      return at(
        57,
        top + 4,
        <g {...ink}>
          <rect x="-7" y="-16" width="14" height="15" rx="1.5" fill="oklch(0.32 0.05 300)" />
          <rect x="-7" y="-5.5" width="14" height="3.5" fill="oklch(0.62 0.19 25)" />
          <ellipse cy="-1" rx="11.5" ry="2.6" fill="oklch(0.32 0.05 300)" />
        </g>,
        " rotate(14)",
      );
  }
}

// Things around the creature rather than on it: they stay put while it bobs.
function MoodExtras({ mood, body }: { mood: Mood; body: Body }) {
  const ink = { stroke: INK, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (mood) {
    case "sleeping":
      return (
        <g fill="none" {...ink} strokeWidth={LINE}>
          {at(73, 16, <path d="M0 0H6L0 7H6" />)}
          {at(83, 6, <path d="M0 0H4L0 4.6H4" />)}
        </g>
      );
    case "sulking":
      // A little storm cloud over its head.
      return at(
        80,
        14,
        <g {...ink} strokeWidth="1.6">
          <path d="M1 5L-2.5 11H1L-1 16L5 8.5H1.6L3.6 5Z" fill="oklch(0.88 0.16 95)" />
          <path
            d="M-9 5A4.2 4.2 0 0 1 -8 -3A5.6 5.6 0 0 1 2.6 -5.4A4.4 4.4 0 0 1 9.6 -1A3.4 3.4 0 0 1 9 5Z"
            fill="oklch(0.78 0.02 260)"
          />
        </g>,
      );
    case "feasting":
      // Crumbs: a few at the mouth, a few on the floor.
      return (
        <g fill="oklch(0.74 0.12 70)" {...ink} strokeWidth="1">
          {[
            [37, body.mouthY + 6, 1.8],
            [63, body.mouthY + 4, 1.5],
            [66, body.mouthY + 10, 1.2],
            [26, 92, 2],
            [74, 93, 1.7],
            [80, 90, 1.2],
          ].map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
          ))}
        </g>
      );
    default:
      return null;
  }
}
