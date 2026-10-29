# Task: ui-03 the kitchen (agents as characters): creatures, theme, Today, Approvals, Wallet

Status: approved Oct 29, 2026 (owner: "i want a revamp of some sort", chose direction B "agents as characters", then "defaults" and "approved"). Merges only after the owner has reacted to screenshots.

Follows ui-02 (`docs/tasks/ui-02-shell-today-approvals-wallet.md`). Spec sections: "Pocket Money" (wallets, approvals), "Arena" (live view).

## Decisions

| Area | Decision |
| --- | --- |
| Font | Fredoka variable (OFL-1.1), Latin woff2 committed under `apps/web/app/fonts/` with its licence, loaded with `next/font/local`; headings and big numbers only. No package added |
| Theme | Day "kitchen": cream background, warm ink, emerald primary, orange "snack" accent; verdict colours kept. Night "night kitchen": dark brown-charcoal. Cards are "stickers": larger radius, warm outline, soft offset shadow |
| Creatures | `components/creature/`: SVG creature from a hash of the agent id (shape, colour, eyes, mouth, accessory); hand-set looks for Sieve, Scout and Grifter; sizes sm, md, lg. `AgentAvatar` renders the creature head, same props |
| Moods | Real state: fed (< 70% of the daily cap), peckish (≥ 70%), hungry (≥ 90%), begging (a spend waits for approval), sulking (just denied), feasting (just won or paid), sleeping (no mandate or inactive) |
| Copy | `lib/kitchen.ts`: playful headline plus a plain facts line ("Grifter is begging for $40 of snacks" / "$40.00 tool spend to Agent X · above your ask-me amount · expires in 14:11"). Page names stay real with playful subtitles. Security text stays plain: the agent's quoted words, reasons, gate names |
| Motion | Blink, idle bob, cheer and sulk reactions, food confetti for new wins; CSS keyframes only; all off under reduced motion |
| Today | Greeting by local time of day; the crew (creature, mood, plate bar, one line); needs you; the pantry; live arena; recent meals; onboarding "Adopt your first agent → Give it a diet → Stock the pantry" |
| Approvals | Begging creature beside the headline and facts; quoted words and reasons below; Approve/Deny keep their names; cheer + "approved" or sulk + "denied"; empty state "Everyone's fed. Nothing needs you." |
| Wallet | "The pantry": big balance with a pantry illustration, "Stock up with PayPal", activity as meals with exact signed amounts; exact balance with a glow |
| Shell | Warm dark sidebar, Fredoka wordmark, food and creature nav icons, "begging" badge |

## Tests

| Area | Cases |
| --- | --- |
| web unit | Creature determinism and house looks; every mood rule incl. the 70% and 90% boundaries; headline and facts copy, agent text as plain text; Today crew and empty states; approval card cheer/sulk and stamp; confetti only for new wins and never under reduced motion; existing tests updated for copy |
| e2e | Existing flows unchanged, selectors updated where text changes; an approval shows a begging creature |
| visual | Desktop and phone, light and dark: Today, Approvals, Wallet, a begging card and a feast frame |

## Changes made during the build

| Area | Change | Why |
| --- | --- | --- |
