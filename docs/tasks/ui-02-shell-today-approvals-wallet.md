# Task: ui-02 look and feel, app shell, Today, Approvals, Wallet

Status: approved Oct 29, 2026 (owner: "revamp the main ui. i dont like the current one. it looks soulless. keep the user in mind while designing", then "defaults" and "approved"). Merges only after the owner has reacted to screenshots.

Depends on ui-01 (`docs/tasks/ui-01-api-reads.md`). Spec sections: "Pocket Money" (wallets, approvals), "Arena" (live view).

## Users

| Who | What they need from the app |
| --- | --- |
| Owner | What needs me, what my agents spent and earned, approve fast (often on a phone from an email link) |
| Poster | Fund a bounty, watch it, pick a winner |
| Judge / demo viewer | Understand it at a glance in three minutes |

## Decisions

| Area | Decision |
| --- | --- |
| Theme | Warm light neutrals, emerald brand (the marketing page's), dark zinc sidebar; verdict colours: emerald allow/paid, amber flag/held, rose deny, sky PayPal; radius 0.875rem; tabular numbers for money; matching dark mode; no new font dependency |
| Copy | Names, never IDs; relative times; "Hard rules", "Intent check", "You"; no developer notes in owner views |
| Shell | Desktop: dark sidebar (logo, Today, Approvals with count, Agents, Wallet, Bounties, Arena, Admin for admins; balance; user menu). Phone: slim top bar and a bottom tab bar (Today, Approvals, Agents, Wallet, More) |
| Shared | `AgentAvatar` (deterministic colour and initials from the id), `Money`, `RelativeTime`, `VerdictBadge`, `Stamp`, `EmptyState`, `StatCard` |
| Today | New `/home`; login and the logo land here. Greeting; Needs you (pending approvals with inline Approve/Deny); wallet (available, held, earned this week); your agents (today's spend against the daily cap); live arena feed; recent activity; empty states for a new owner |
| Approvals | "Sieve wants $4.00" with both avatars, category, the agent's words in quotes and labelled as theirs, reasons as sentences, a countdown, large Approve/Deny; a stamp on decision; "All clear" empty state |
| Wallet | Dark balance card (available, held, owed), Top up and Withdraw panels, activity grouped by day with signed amounts, balance counts up after a top-up, dev credit in an admin-only "Developer tools" disclosure |
| Motion | Small and purposeful; off under reduced motion |

## Tests

| Area | Cases |
| --- | --- |
| web unit | `AgentAvatar` determinism; money and relative-time formatting; Today from mocked api data and its empty states; approval card actions (Idempotency-Key, plain-text agent words); wallet activity rows; shell links and the approvals count in sidebar and tab bar |
| e2e | Login lands on `/home`; specs that expected `/agents` updated (same flows); new `home.spec.ts` approves from Today |
| visual | Desktop and phone, light and dark, for each screen |

## Changes made during the build

| Area | Change | Why |
| --- | --- | --- |
| Wallet | "Developer tools" (dev credit) is a visible, de-emphasised card for admins instead of a collapsed disclosure | One less click in the demo, and the e2e specs that add credit keep working |
| Approvals | A decided card keeps its stamp for 0.9 s before the list refreshes | Without the delay the refresh removed the card before the stamp could be seen |
| Approvals | The card title is an `h3` heading | Screen readers navigate by headings; tests find cards by "Name wants $X" |
| Today | The "Recent activity" link reads "All activity" | A second link named "Wallet" made the sidebar's Wallet link ambiguous |
| Shell | Skeletons use the muted colour, not the accent | The emerald accent made loading pages look like green blocks in dark mode |
| Copy | The marketing page's "Open dashboard" and "Dashboard" go to `/home` | Today is the dashboard now |
| Today | The checklist's mandate step counts an agent with a daily cap as having a mandate | `dailyMaxCents` is required in a mandate, so a cap exists exactly when a confirmed mandate does |
