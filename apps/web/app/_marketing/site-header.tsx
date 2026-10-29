"use client";

// mkt-02: the marketing page's header, fixed to the top. See-through with a blur over the dark hero, solid once the
// hero is scrolled past, with a thin bar showing how far down the page the reader is.
import { CoinsIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const NAV_CTA =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors";
// Past this many pixels the header turns solid (about the hero's height on a phone).
const SOLID_AFTER_PX = 480;

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const [solid, setSolid] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setSolid(window.scrollY > SOLID_AFTER_PX);
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
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
  }, []);

  return (
    <header
      data-solid={solid}
      className={`fixed inset-x-0 top-0 z-50 border-b text-zinc-100 transition-colors duration-300 ${
        solid ? "border-white/10 bg-zinc-950/95" : "border-transparent bg-zinc-950/40 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <CoinsIcon className="size-5 text-emerald-400" aria-hidden /> Agents Gotta Eat
        </Link>
        <nav className="flex items-center gap-2 text-sm" aria-label="Account">
          {signedIn ? (
            <Link href="/home" className={`${NAV_CTA} text-zinc-200 hover:bg-white/10`}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className={`${NAV_CTA} text-zinc-200 hover:bg-white/10`}>
                Log in
              </Link>
              <Link href="/login?mode=signup" className={`${NAV_CTA} bg-white text-zinc-950 hover:bg-zinc-200`}>
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
      <div
        aria-hidden
        data-testid="scroll-progress"
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-gradient-to-r from-emerald-400 to-sky-400"
        style={{ transform: `scaleX(${progress})` }}
      />
    </header>
  );
}
