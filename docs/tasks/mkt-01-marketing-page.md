# Task: mkt-01 marketing page

Status: approved Oct 28, 2026 (owner: "the root link should be marketing page which goes to login and signup", then "approved").

Spec sections: "Overview" (pitch, the two components, goals), "Security" (the attacks we stop), "Testing and verification" (the numbers we can stand behind), "Pre-submission checklist" (hosted URL works logged out).

## Decisions

| Area | Decision |
| --- | --- |
| Route | `/` is the marketing page for everyone. Signed out: "Sign up" (`/login?mode=signup`) and "Log in" (`/login`). Signed in: "Open dashboard" (`/agents`). "Watch the demo" (`/demo`) for both. The old redirect (`homeTarget`) goes |
| Sign up | No separate flow: an account is created the first time someone signs in (GitHub, or the demo owner). `/login?mode=signup` only changes the heading and description |
| Wow element | A dark hero with a scripted, client-side policy-gate simulator: spend cards travel through Hard rules → Intent check → Owner; legit spends settle, Grifter's "task says…" spend is caught at the intent check, an over-cap spend bounces off gate 1, an injected reason is screened. Running totals of allowed and blocked money. No api calls. `prefers-reduced-motion`: a static frame |
| Market stats | Only sourced figures, each linked: Bain (US agentic commerce $300–500B by 2030, 15–25% of e-commerce), Gartner (at least 15% of day-to-day work decisions by agentic AI by 2028, from 0% in 2024; over 40% of agentic AI projects cancelled by 2027, inadequate risk controls among the reasons), OWASP (prompt injection is LLM01, the top LLM risk) |
| Proof stats | Real numbers from this repo, constants with a comment naming where each comes from: 1,031 api tests; 13 end-to-end flows; 40 injection attacks, 0 wrong payouts; 0 double spends under 50 simultaneous spends; 0 floats (integer cents); 7 PayPal APIs; 15 MCP tools |
| Honesty | Footer and hero say "PayPal sandbox · built for the PayPal AI Hackathon 2026". No users, revenue or logos implied |
| Style | The app's Tailwind/shadcn tokens, a dark hero, lucide icons; no new dependencies; responsive to phone width |

## Tests

| Area | Cases |
| --- | --- |
| web unit | CTAs point at `/login?mode=signup`, `/login`, `/demo`; signed in shows "Open dashboard"; each market stat links its source; login sign-up heading; simulator renders its gates and a static frame under reduced motion |
| e2e | `demo.spec.ts`: logged-out `/` is the marketing page; "Watch the demo" opens the replay. `marketing.spec.ts`: sign up → login → demo owner → `/agents` |
| visual | desktop and phone screenshots |

## Changes made during the build

| Area | Change | Why |
| --- | --- | --- |
| Proof stats | Dropped "0 floats" as a stat; integer cents is said in the Problem section instead | Six cards read better than seven, and "0 floats" needs explaining |
| Proof stats | End-to-end count is 15, not 13 | `marketing.spec.ts` adds two flows |
| CTA | "Sign up free" became "Sign up" | Nothing is paid, so "free" implied a paid tier |
| Tests | `app/page.test.ts` (the redirect) replaced by `app/page.test.tsx`; `homeTarget` tests removed with the function | `/` no longer redirects |
| e2e | `marketing.spec.ts` also checks no horizontal scroll at 390 px and the reduced-motion still frame | The phone layout and motion setting are part of the decision |
