# uat-fix-06-hydration: intermittent React error #418 on /agents and /bounties/new

Spec sections touched: web app shell and the signed-in pages. No code change (see Result).

## Symptom

"Minified React error #418" (hydration mismatch) in the browser console after sign-in, on /agents and /bounties/new
(also seen on /arena). Production build only, about 3 of 30 cold-session loads. Dev: 32 loads clean. Warm prod: about
260 loads clean. `uat-fix-03-web.md` item 5 investigated it and found nothing.

## Method and evidence

1. Audited `apps/web` for non-deterministic render inputs (`Date`, `Intl`, `toLocale*`, `Math.random`, `window`,
   `localStorage`, `matchMedia`, `useSyncExternalStore`, `useId`, `suppressHydrationWarning`, `process.env`).
2. Production build (`next build`, Next 15.5.27) and `next start` on a private stack: web 3500, api 3501, fake PayPal
   4510, DB `gottaeat_uat_fix06` (dropped afterwards).
3. Playwright + Chrome, a new browser context per load sequence, each doing the demo-owner sign-in and then loading
   /agents, /bounties/new, /arena, /home, /wallet (hard navigations), listening for `console.error` and `pageerror`
   matching 418/423/425/hydration. The loop saves the SSR HTML and the final DOM for any failure.
4. Positive control: the SSR HTML of /agents was rewritten in flight (one word changed). The loop's detector caught
   `Minified React error #418` immediately, so a real mismatch would have been seen.

| Run | Contexts | Page loads | Variation | #418 |
| --- | --- | --- | --- | --- |
| baseline | 43 | 215 | desktop Chrome, wait for network idle | 0 |
| CPU 6x throttle | 30 | 150 | 3 contexts in parallel | 0 |
| mixed | 32 | 160 | CPU 4x, 150 ms latency + slow bandwidth, 4 locales, 4 time zones, dark/light, reduced motion, 4 in parallel | 0 |
| fast | 24 | 120 | CPU 8x, no wait for idle after sign-in, 6 in parallel | 0 |

Total 129 contexts, 645 hard loads, no hydration error and no other console error.

## What the audit found (all ruled out)

Every time-, locale- or browser-dependent value in the shell and the two pages is already server-deterministic or
applied after mount:

- `RelativeTime`, `LocalTime`, `Countdown`, `ApprovalCard`, `Greeting`: render a fixed UTC string first (`format.ts`
  uses `en-US`, `timeZone: "UTC"`), swap to local/relative text in `useEffect`.
- `event-feed.tsx` `TIME` is `timeZone: "UTC"`; `EventFeedList` gets lines only from SSE after mount.
- `/bounties/new` default deadline and `/agents` crew moods use `Date.now()` in the server component only; the value
  reaches client components as a prop, so SSR and hydration see the same input.
- `FeastConfetti`, `CountUp`, marketing components read `localStorage`/`matchMedia` only inside effects.
- `Creature` is a deterministic server component (looks hashed from the agent id); no `Math.random`, no `useId` use in
  the shell. Theme: `next-themes` with `suppressHydrationWarning` on `<html>`; Sonner's `Toaster` only differs by
  attribute, which React does not report as #418.
- `NoticeToast` (`useSearchParams`) sits in a `Suspense` boundary and renders nothing.
- `suppressHydrationWarning` appears only on `<html>` and one deliberate span in `approval-card.tsx`.

## Cause

Not found. Nothing in the app's own render path can differ between the server HTML and the first client render, and
645 production loads (including slow-CPU, slow-network, locale/time-zone and parallel variations) never produced the
error. The most likely remaining source is outside the app: a browser extension or translation feature that changes
DOM text or structure inside the React tree between the HTML arriving and hydration finishing. A cold load hydrates
later than a warm one, so such a change has a longer window to land, which fits "cold only, random page, never in
dev automation". This is a hypothesis, not a finding: a simple injected node did not trigger #418 in my test either
(React 19 tolerates extra body/app nodes), so I cannot confirm it.

## Fix

None. The task says not to make speculative changes, and I did not want to add `suppressHydrationWarning` that would
hide the symptom without a known cause.

## If it shows up again

Capture, in the affected browser, a private window with extensions disabled, and note whether the error recurs. If it
does, save the page source (view-source) and `document.documentElement.outerHTML` after the error and diff them: the
loop in this investigation did exactly that (`SSR` vs `DOM`) and would have pinpointed the node.
