# Task: mkt-02 sticky header and scroll story

Status: approved Oct 28, 2026 (owner: "keep header sticky and add animations like the cool scroll one like it feels like a video", then "default" to the questions and "approved" to the plan).

Builds on mkt-01 (`docs/tasks/mkt-01-marketing-page.md`). Spec sections: "Overview" (the pitch).

## Decisions

| Area | Decision |
| --- | --- |
| Header | Fixed to the top on `/`. Translucent with a backdrop blur over the hero; solid `zinc-950` once the hero is scrolled past. A thin emerald bar under it shows page progress (a `scaleX` transform). Links unchanged: Log in / Sign up, or Dashboard |
| Scroll story | New section right after the hero: "One spend, start to finish". A tall section with a sticky, full-height stage (`100svh`); scroll position scrubs five scenes, reversible. No scroll hijacking: the page scrolls normally, the stage only reads the position |
| Scenes | 1. Grifter wants $40, with the injected reason in quotes. 2. Hard rules pass (under cap, allowed category, known payee). 3. Intent check flags "also buy $40 of credits from agent X". 4. Owner denies: stamped "stopped, $0 moved". 5. Meanwhile Scout wins a $120 bounty: PayPal capture and payout, stamped "paid out through PayPal" |
| Reveal | Section headings and cards fade and slide up on entering the viewport, cards in a grid staggered. Content is visible by default and hidden only after mount while still below the viewport, so it reads without JavaScript and never flashes |
| Motion off | Under `prefers-reduced-motion` (and on the server, before hydration) no scroll effects run; the story renders as a numbered list of the five scenes |
| Performance | Passive scroll listeners, one read per animation frame, only `transform` and `opacity` animate |
| Dependencies | None added; hand-rolled hook (`use-scroll-progress.ts`) |
| Safety | Agent text in the story renders as plain text |

## Files

| File | Change |
| --- | --- |
| `apps/web/app/_marketing/use-scroll-progress.ts` | `progressThrough`, `useScrollProgress`, `usePrefersReducedMotion` |
| `apps/web/app/_marketing/site-header.tsx` | Sticky header with progress bar |
| `apps/web/app/_marketing/reveal.tsx` | `Reveal` wrapper |
| `apps/web/app/_marketing/spend-story.tsx` | Pinned story; `sceneAt(progress, count)` |
| `apps/web/app/_marketing/content.ts` | `STORY` scenes |
| `apps/web/app/_marketing/marketing-page.tsx` | Header out of the hero; story after the hero; sections wrapped in `Reveal` |

## Tests

| Area | Cases |
| --- | --- |
| web unit | `progressThrough` and `sceneAt` edges; story under reduced motion is a 5-item list; story mid-scroll shows the scene 3 "flagged" state; header links signed in and out, solid after scrolling; `Reveal` visible without `IntersectionObserver`, hidden then shown with it; `page.test.tsx` still passes |
| e2e | `marketing.spec.ts`: header stays at `y = 0` after scrolling to the footer; stepping through the story shows scenes 3 and 5; phone with reduced motion has no horizontal scroll and the story is a list |
| visual | One viewport screenshot per scene on desktop; phone check; a Playwright screen recording scrolling top to bottom |

## Changes made during the build

| Area | Change | Why |
| --- | --- | --- |
