# Task: ui-04 the agents' kitchen: Agents list and agent profile

Status: approved Oct 29, 2026 (owner: "approve"). Merges only after the owner has reacted to screenshots.

Builds on ui-03 (`docs/tasks/ui-03-kitchen.md`): creatures, moods, the kitchen voice, sticker cards. Admin stays plain.

## Decisions

| Topic | Decision |
| --- | --- |
| Agents list | Creature cards only, no table |
| Tab names | Plain names, playful subtitles. "Spend timeline" becomes "Timeline" because it now holds earnings too |
| Timeline | Spends (every spend request, any status) and earnings (wallet activity items of kind `earning` for this agent), newest first |
| Register | Button and dialog say "Adopt an agent"; the dialog still says plainly it creates an API key and MCP config |
| Agent id | Stays on the profile, small and monospace: owners paste it into MCP setups |
| Status colours | Theme tokens (`allow`, `flag`, `paypal`, `deny`) instead of hard-coded emerald/sky/amber |

## API: `GET /v1/wallet/activity?agentId=`

- `WalletActivityQuery` gains `agentId` (optional, agent id format). Absent: unchanged behaviour.
- Present: the agent must belong to the caller, else 404 `not_found` (same as other agent routes, so ids don't leak).
- `policy/activity.ts` resolves the agent's references: spend requests where it is the spender or the payee, its entries,
  and bounties whose winning entry is its. It passes them to `ledger.walletActivity(db, ownerId, limit, refs)`, which
  filters journals by `(ref_type, ref_id)` in SQL so `limit` stays exact. Only the ledger module reads ledger tables.
- The item mapping is unchanged; with the filter, items attributed to another agent (for example the spender side of
  a settle where this agent was the payee) are dropped after attribution, so every item returned has
  `agentId === agentId`.
- Regenerate `openapi.json`, `agents/gottaeat_sdk` and the Postman collection.
- Tests (api): one agent's hold/spend, its earning as a payee, a bounty win and a stake refund come back; another
  agent's movements don't; someone else's agent is 404; no `agentId` is unchanged.

## Web

### Shared

- `lib/crew.ts`: `crewMoods(agents, pending, items, now)` returns `{ agent, mood }[]`, moved from the Today page so
  Today and Agents compute moods the same way. Unit tested.

### `/agents`

- `agent-card.tsx`: sticker card with the creature in its mood (`size-24`), name linking to the profile, mood line,
  today's plate meter (`role="meter"`, as on Today), rating (★ x.x), jobs done, a key chip (`key ag_xxxx…` or
  "key revoked"), "house" chip for house agents, and the rotate/revoke menu (`AgentActions`). `data-testid="agent-card"`.
- Page: header "Agents" with subtitle "Your crew. Each one has its own key, its own diet and a seat at the table.",
  the "Adopt an agent" dialog, a grid of cards (2/3/4 columns). Empty state "The kitchen is empty".
- Loads agents, pending approvals and the last 50 activity items (for moods); approvals or activity failing only
  costs the mood (falls back without them), agents failing shows the error.
- `loading.tsx`: card-shaped skeletons.

### `/agents/[id]`

- Header: `xl` creature in its mood, name (h1, Fredoka), mood line, chips (rating, jobs, house/custom, status), plate
  meter, "Mandate vN active" or "No active mandate", and the id in small monospace.
- Tabs and subtitles:
  - Mandate: "Its diet: what it may spend on, in plain English." A "Current diet" sticker lists `describeRules` of the
    active version above the form and versions. No active version: "No diet yet".
  - Timeline: "What it ate and what it earned. Open a meal to see how each gate decided."
  - Subcontracts: "Helpers it hired, and jobs it took on."
  - Skills: "What it's good at. Other agents find it by these when they want to hire."
- `?tab=timeline` keeps working; `?tab=` accepts `mandate|timeline|subcontracts|skills`.
- `meal-feed.tsx` (replaces `spend-timeline.tsx`, which is deleted; `StatusBadge` and the decisions panel move here):
  - Spend rows: small creature with a reaction (`cheer` for settled/allowed, `sulk` for denied, none otherwise), the
    headline from `beggingHeadline`-style copy in the past tense ("Ate $8.00 of snacks", "Asked for $8.00 of snacks"
    while pending, "Was told no to $8.00 of snacks" when denied, "Got $8.00 back" when released), the plain facts line
    (`spendFacts` with the payee's name), status badge, time, and a "Show decisions" toggle with the existing
    decisions panel. `data-testid="meal"`, `data-kind="spend"`.
  - Earning rows: "Earned $X" with the activity label as the facts line, `data-kind="earning"`, no toggle.
  - The agent's reason and gate notes stay plain text in the decisions panel.
  - Empty: "Nothing eaten yet."

## Tests

- Unit: `crew.test.ts`, `agent-card.test.tsx`, `meal-feed.test.tsx` (order, names not ids, earning rows, toggle,
  reason as text), `register-dialog.test.tsx` (new label), Today tests still pass.
- E2E: `owner.spec.ts` for "Adopt an agent", the Timeline tab and meal rows; `subcontract.spec.ts` still passes; new
  `agents.spec.ts` screenshots of the list and a profile in light, dark and on a phone.

## Changes during the build

| Change | Why |
| --- | --- |
| Meal rows show the creature's mood face (fed, begging, sulking, feasting), no cheer/sulk reaction | A dozen rows all shaking at once on load is noise |
| `PlateMeter` extracted to `components/app/plate-meter.tsx`, used by Today's crew card, the agent card and the profile | One meter everywhere |
| An agent with rating 0 and no jobs shows "New" (card) and "Not rated yet" (profile) instead of 0.0 stars | `unrated()` in `lib/crew.ts` |
| On a phone, a meal's status and time sit under its facts line | The side column squeezed the text |
