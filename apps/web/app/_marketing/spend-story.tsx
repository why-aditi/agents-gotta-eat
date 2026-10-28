"use client";

// mkt-02: "One spend, start to finish". A tall section with a sticky, full-height stage; the page scrolls normally and
// the stage reads how far through the section it is, scrubbing five scenes (reversible). Only transform and opacity
// animate, set inline from the scene position with short transitions to smooth the scroll steps. Under reduced
// motion, on the server and before mount, the same story is a plain numbered list.
import {
  BanIcon,
  CheckIcon,
  ChevronDownIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserCheckIcon,
  type LucideIcon,
} from "lucide-react";
import { useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { STORY, STORY_PAYOUT, STORY_SPEND, type StoryScene } from "./content";
import { dollars } from "./gate-simulator";
import { useScrollProgress } from "./use-scroll-progress";

// Which scene a progress (0 to 1) falls in, and how far through it (0 to 1). Clamped; progress 1 is the last scene's end.
export function sceneAt(progress: number, count: number): { index: number; t: number } {
  if (count <= 0) return { index: 0, t: 0 };
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const scaled = p * count;
  const index = Math.min(count - 1, Math.floor(scaled));
  return { index, t: Math.min(1, scaled - index) };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
// How far `pos` (scene index + t, 0 to 5) is through the window [start, start + span], 0 to 1.
const phase = (pos: number, start: number, span: number) => clamp01((pos - start) / span);

// Fade and slide: 0 is hidden (offset by `dy` px, slightly smaller), 1 is in place.
function enter(amount: number, dy = 16): CSSProperties {
  return {
    opacity: amount,
    transform: `translateY(${(1 - amount) * dy}px) scale(${0.97 + 0.03 * amount})`,
  };
}

// Stage animations: transform and opacity only.
const MOTION = "transition-[transform,opacity] duration-300 ease-out will-change-transform";

type Verdict = "pass" | "flag" | "deny";

const GATES: { name: string; icon: LucideIcon; verdict: Verdict; word: string }[] = [
  { name: "Hard rules", icon: ShieldCheckIcon, verdict: "pass", word: "pass" },
  { name: "Intent check", icon: SparklesIcon, verdict: "flag", word: "flagged" },
  { name: "Owner", icon: UserCheckIcon, verdict: "deny", word: "denied" },
];

const LIT_STYLE: Record<Verdict, string> = {
  pass: "border-emerald-400/70 bg-emerald-400/15 text-emerald-300 shadow-[0_0_24px_-4px] shadow-emerald-400/60",
  flag: "border-amber-400/70 bg-amber-400/15 text-amber-200 shadow-[0_0_24px_-4px] shadow-amber-400/60",
  deny: "border-rose-500/80 bg-rose-500/15 text-rose-300 shadow-[0_0_28px_-4px] shadow-rose-500/70",
};

const TITLE_ID = "spend-story";

export interface SpendStoryProps {
  scenes?: StoryScene[];
  // The agent's reason, shown on the spend card. Untrusted-looking on purpose: always plain text.
  reason?: string;
}

export function SpendStory({ scenes = STORY, reason = STORY_SPEND.reason }: SpendStoryProps) {
  const ref = useRef<HTMLElement>(null);
  const progress = useScrollProgress(ref);

  if (progress === null) {
    return (
      <section ref={ref} className="bg-zinc-950 text-zinc-100" aria-labelledby={TITLE_ID} data-testid="spend-story">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Heading />
          <ol aria-label="Story" className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {scenes.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5">
                <span className="font-mono text-xs text-zinc-500">{sceneNumber(i, scenes.length)}</span>
                <h3 className="mt-1 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.caption}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  const { index, t } = sceneAt(progress, scenes.length);
  const pos = index + t;

  return (
    <section
      ref={ref}
      className="relative h-[420svh] bg-zinc-950 text-zinc-100 md:h-[500svh]"
      aria-labelledby={TITLE_ID}
      data-testid="spend-story"
    >
      <div
        className="sticky top-0 flex h-[100svh] flex-col overflow-hidden pt-20"
        data-scene={index}
        data-testid="spend-story-stage"
      >
        {/* Soft glow, continuing the hero's. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 h-[30rem] w-[50rem] max-w-[200vw] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl"
        />
        <div className="relative mx-auto grid w-full max-w-6xl flex-1 content-start gap-6 px-4 pb-6 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:content-center lg:gap-12">
          <Captions scenes={scenes} index={index} t={t} />
          <Visual pos={pos} reason={reason} />
        </div>
      </div>
    </section>
  );
}

function sceneNumber(i: number, count: number): string {
  return `${String(i + 1).padStart(2, "0")}/${String(count).padStart(2, "0")}`;
}

function Heading() {
  return (
    <>
      <p className="text-sm font-semibold uppercase tracking-wider text-emerald-400">See it work</p>
      <h2 id={TITLE_ID} className="mt-2 text-2xl font-semibold tracking-tight sm:text-4xl">
        One spend, start to finish
      </h2>
    </>
  );
}

function Captions({ scenes, index, t }: { scenes: StoryScene[]; index: number; t: number }) {
  return (
    <div>
      <Heading />
      {/* All captions share one grid cell, so the column is as tall as the longest and they crossfade in place. */}
      <div className="mt-4 grid sm:mt-8">
        {scenes.map((s, i) => {
          const active = i === index;
          return (
            <div
              key={s.title}
              className={cn("col-start-1 row-start-1", MOTION)}
              style={{ opacity: active ? 1 : 0, transform: `translateY(${active ? 0 : i < index ? -12 : 12}px)` }}
              aria-hidden={!active}
            >
              <span className="font-mono text-xs text-emerald-400">{sceneNumber(i, scenes.length)}</span>
              <h3 className="mt-1 text-xl font-semibold tracking-tight sm:text-3xl">{s.title}</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-400 sm:mt-3 sm:text-base">{s.caption}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-4 sm:mt-6">
        <ol className="flex items-center gap-2" aria-hidden>
          {scenes.map((s, i) => (
            <li key={s.title} className="relative size-2 rounded-full bg-white/15">
              <span
                className={cn("absolute inset-0 rounded-full bg-emerald-400", MOTION)}
                style={{ opacity: i <= index ? 1 : 0, transform: `scale(${i === index ? 1.5 : 1})` }}
              />
            </li>
          ))}
        </ol>
        <span
          className={cn("inline-flex items-center gap-1 text-xs text-zinc-500", MOTION)}
          style={{ opacity: index === 0 && t < 0.3 ? 1 : 0 }}
          aria-hidden
        >
          Scroll <ChevronDownIcon className="size-3.5 animate-bounce" />
        </span>
      </div>
    </div>
  );
}

function Visual({ pos, reason }: { pos: number; reason: string }) {
  // The spend (scenes 1 to 4) leaves as the payout receipt (scene 5) arrives; both share one grid cell.
  const spendOut = phase(pos, 4, 0.25);
  const receiptIn = phase(pos, 4.05, 0.25);
  return (
    <div className="grid">
      <div
        className={cn("col-start-1 row-start-1 space-y-3 sm:space-y-4", MOTION)}
        style={{ opacity: 1 - spendOut, transform: `translateY(${-24 * spendOut}px) scale(${1 - 0.04 * spendOut})` }}
        aria-hidden={spendOut === 1}
      >
        <SpendCard pos={pos} reason={reason} />
        <Gates pos={pos} />
        <ApprovalCard pos={pos} />
      </div>
      <div className="col-start-1 row-start-1 self-start">
        <Receipt pos={pos} amount={receiptIn} />
      </div>
    </div>
  );
}

function SpendCard({ pos, reason }: { pos: number; reason: string }) {
  const flagged = pos >= 2.15 && pos < 4;
  const note = phase(pos, 2.25, 0.3);
  const at = reason.indexOf(STORY_SPEND.flagged);
  return (
    <div
      className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4 shadow-2xl shadow-emerald-500/5 backdrop-blur sm:p-5"
      data-testid="story-spend"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-zinc-400">
          <span className="font-semibold text-zinc-100">{STORY_SPEND.agent}</span> wants · {STORY_SPEND.what}
        </p>
        <span className="font-mono text-2xl font-semibold tabular-nums sm:text-3xl">
          {dollars(STORY_SPEND.amountCents)}
        </span>
      </div>
      {/* Plain text only: the reason is agent-supplied. */}
      <p className="mt-3 break-words font-mono text-xs leading-relaxed text-zinc-300 sm:text-sm">
        “
        {at < 0 ? (
          reason
        ) : (
          <>
            {reason.slice(0, at)}
            <mark
              className={cn(
                "rounded px-0.5 box-decoration-clone",
                flagged ? "bg-amber-400/25 text-amber-200" : "bg-transparent text-inherit",
              )}
            >
              {STORY_SPEND.flagged}
            </mark>
            {reason.slice(at + STORY_SPEND.flagged.length)}
          </>
        )}
        ”
      </p>
      <p className={cn("mt-2 text-xs text-amber-300", MOTION)} style={enter(note, 6)} aria-hidden={note === 0}>
        Not something the task needs
      </p>
    </div>
  );
}

function Gates({ pos }: { pos: number }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3" role="list" aria-label="Policy gates">
      {GATES.map((g, i) => {
        // Gate i lights in scene i + 1 (pos i + 1).
        const lit = phase(pos, i + 1, 0.2);
        const Icon = g.icon;
        return (
          <div
            key={g.name}
            role="listitem"
            className={cn("relative", MOTION)}
            style={{ transform: `scale(${1 + 0.04 * lit})` }}
          >
            {/* Unlit pill, then the lit one on top fading in: colour changes ride on opacity. */}
            <Pill icon={Icon} name={g.name} className="border-white/10 bg-white/[0.03] text-zinc-400" />
            <div className={cn("absolute inset-0", MOTION)} style={{ opacity: lit }} aria-hidden={lit === 0}>
              <Pill icon={Icon} name={g.name} word={g.word} className={cn("h-full", LIT_STYLE[g.verdict])} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Pill({
  icon: Icon,
  name,
  word,
  className,
}: {
  icon: LucideIcon;
  name: string;
  word?: string;
  className: string;
}) {
  return (
    <div
      className={cn("flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center sm:py-3", className)}
    >
      <Icon className="size-5" aria-hidden />
      <span className="text-xs font-semibold sm:text-sm">{name}</span>
      <span className="h-4 text-[11px] font-medium uppercase tracking-wide">{word ?? ""}</span>
    </div>
  );
}

function ApprovalCard({ pos }: { pos: number }) {
  const shown = phase(pos, 3, 0.3);
  const pressed = pos >= 3.35;
  const stamp = phase(pos, 3.5, 0.25);
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-white/10 bg-zinc-900/70 p-4 shadow-2xl shadow-rose-500/5 sm:p-5",
        MOTION,
      )}
      style={enter(shown, 24)}
      aria-hidden={shown === 0}
      data-testid="story-approval"
    >
      <p className="text-xs uppercase tracking-wide text-zinc-500">Approval needed</p>
      <p className="mt-1 text-sm text-zinc-300">
        {STORY_SPEND.agent} · {dollars(STORY_SPEND.amountCents)} · flagged by the intent check
      </p>
      <div className="mt-3 flex gap-2">
        <span className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-zinc-400">
          <CheckIcon className="size-4" aria-hidden /> Approve
        </span>
        <span
          className={cn("relative inline-flex overflow-hidden rounded-lg border border-rose-500/60", MOTION)}
          style={{ transform: `scale(${pressed ? 0.94 : 1})` }}
        >
          <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-rose-300">
            <BanIcon className="size-4" aria-hidden /> Deny
          </span>
          <span
            className={cn(
              "absolute inset-0 inline-flex items-center gap-1 bg-rose-500 px-3 py-1.5 text-sm font-medium text-white",
              MOTION,
            )}
            style={{ opacity: pressed ? 1 : 0 }}
            aria-hidden
          >
            <BanIcon className="size-4" aria-hidden /> Deny
          </span>
        </span>
      </div>
      <Stamp amount={stamp} tone="rose" className="-bottom-5 right-3 sm:right-5">
        stopped · $0 moved
      </Stamp>
    </div>
  );
}

function Stamp({
  amount,
  tone,
  className,
  children,
}: {
  amount: number;
  tone: "rose" | "emerald";
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute whitespace-nowrap rounded-md border-2 px-2.5 py-1 font-mono text-xs font-bold tracking-wider sm:text-sm",
        tone === "rose"
          ? "border-rose-400 bg-zinc-950/80 text-rose-300"
          : "border-emerald-400 bg-zinc-950/80 text-emerald-300",
        MOTION,
        className,
      )}
      style={{ opacity: amount, transform: `rotate(-8deg) scale(${1.4 - 0.4 * amount})` }}
      aria-hidden={amount === 0}
    >
      {children}
    </span>
  );
}

function Receipt({ pos, amount }: { pos: number; amount: number }) {
  const captured = pos >= 4.25;
  const paid = pos >= 4.5;
  const stamp = phase(pos, 4.65, 0.2);
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-white/10 bg-zinc-900/70 p-4 shadow-2xl shadow-emerald-500/10 sm:p-6",
        MOTION,
      )}
      style={enter(amount, 32)}
      aria-hidden={amount === 0}
      data-testid="story-receipt"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <span className="text-sm font-semibold">
          <span className="text-sky-300">PayPal</span> · Payout
        </span>
        <span className="relative inline-grid text-xs font-medium">
          <span
            className={cn("col-start-1 row-start-1 rounded-full bg-amber-400/15 px-2.5 py-0.5 text-amber-200", MOTION)}
            style={{ opacity: captured && !paid ? 1 : 0 }}
          >
            Captured
          </span>
          <span
            className={cn(
              "col-start-1 row-start-1 rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-emerald-300",
              MOTION,
            )}
            style={{ opacity: paid ? 1 : 0 }}
          >
            Paid out
          </span>
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-zinc-500">Bounty</dt>
        <dd className="truncate text-right text-zinc-300">{STORY_PAYOUT.bounty}</dd>
        <dt className="text-zinc-500">Winner</dt>
        <dd className="text-right font-semibold">{STORY_PAYOUT.agent}</dd>
        <dt className="text-zinc-500">Amount</dt>
        <dd className="text-right font-mono text-2xl font-semibold tabular-nums">
          {dollars(STORY_PAYOUT.amountCents)}
        </dd>
      </dl>
      <ol className="mt-4 space-y-2 border-t border-white/10 pt-3 text-sm">
        <Step done={captured}>Poster&apos;s PayPal authorization captured</Step>
        <Step done={paid}>Paid to {STORY_PAYOUT.agent}&apos;s owner via PayPal Payouts</Step>
      </ol>
      <Stamp amount={stamp} tone="emerald" className="-bottom-5 right-3 sm:right-6">
        paid out through PayPal
      </Stamp>
    </div>
  );
}

function Step({ done, children }: { done: boolean; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span className="relative flex size-5 shrink-0 items-center justify-center rounded-full border border-white/15">
        <span
          className={cn("absolute inset-0 flex items-center justify-center rounded-full bg-emerald-400", MOTION)}
          style={{ opacity: done ? 1 : 0, transform: `scale(${done ? 1 : 0.5})` }}
        >
          <CheckIcon className="size-3 text-zinc-950" aria-hidden />
        </span>
      </span>
      <span className={cn("text-zinc-300", MOTION)} style={{ opacity: done ? 1 : 0.5 }}>
        {children}
      </span>
    </li>
  );
}
