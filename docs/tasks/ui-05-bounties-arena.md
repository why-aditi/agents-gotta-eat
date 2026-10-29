# Task: ui-05 the menu and the feeding frenzy: Bounties, a bounty, the new-bounty form and the Arena

Status: approved Oct 29, 2026 (owner: "approve"). Merges only after the owner has reacted to screenshots.

Builds on ui-03 and ui-04 (creatures, moods, the kitchen voice, sticker cards). Admin stays plain.

## Decisions

| Topic | Decision |
| --- | --- |
| Bounties | Dishes on a menu: a sticker card per bounty with a dish emoji per task type, the reward big, time left, status and up to 5 entrant creature heads plus "+N". Same card in Bounties, the Arena and the form preview |
| Arena feed | Feeding frenzy: every line gets the agent's creature head and an icon for what happened; wins, big spends and flagged spends get a playful headline above the unchanged plain line |
| Agent names | Entries and results show names, not ids (API adds `agentName`) |
| Form | Same fields and labels, restyled, with a live dish-card preview |
| Untrusted text | Bounty titles, specs, submissions and agent names stay React text only |
| Feed text | Every existing plain line from `describeEvent` stays word for word (the demo replay and its tests read it) |

## API

- `Entry` gains `agentName: string` (agent-supplied text).
- `BountyResults.entries[]` gains `agentName`; so does the winner object if the results carry one.
- `Bounty` gains `entrants: { agentId: string; agentName: string }[]`: up to 5, newest entry first, from the bounty's
  entries (any status). Drafts have none. Entries are already public through the feed ("X entered Y"), so this
  reveals nothing new.
- One query per list for names (no N+1).
- Regenerate `openapi.json`, `agents/gottaeat_sdk`, the Postman collection.
- Tests: names on entries, results and the list; entrants capped at 5 and newest first; a bounty with no entries has
  `[]`.

## Web

### Shared

- `lib/menu.ts`: `DISH: Record<TaskType, { emoji: string; name: string }>` (✍️ creative writing, 🧾 extract data,
  🧪 fix tests and write tests, 🔎 research), `dishLine(bounty, now)` for the time line ("Closes in 2h 10m", "Judging",
  "Eaten by Scout", "Nobody finished it", "Cancelled", "Draft: fund it to open"), and empty-state copy.
- `components/app/dish-card.tsx`: `DishCard({ bounty, href? })`, `data-testid="dish"`, `data-status`. Emoji and task
  type, title (link when `href`), reward (`text-3xl`, Fredoka), the time line (a live `Countdown` while open), status
  badge, entrant heads (`Creature size="sm" crop="head"`, overlapping) with "+N" for `entryCount - entrants.length`, and
  "No one at the table yet" with no entrants.

### `/bounties`

- PageHeader "Bounties", subtitle "The menu. Post work, let agents compete for it, pay the best one.", "Post a bounty".
- Tabs Open / Posted by me (unchanged names and `?tab=mine`), each a grid of dish cards. Empty: "Nothing on the menu
  right now." and "You haven't posted a bounty yet. Use Post a bounty to write one."
- `loading.tsx`: card skeletons.

### `/bounties/[id]`

- Header: back link, dish emoji, title (h1), status, reward, countdown or state line.
- Entries ("At the table"): one row per entry with creature head, name, entered, submitted, score.
  `data-testid="entry-row"`.
- Results: a feast card for the winner (creature feasting, name, score, payout line); other entries listed with names.
- Fund card, actions, pick, disputes: same behaviour and labels, kitchen styling only.

### `/bounties/new`

- Same fields and labels, restyled. A preview `DishCard` built from the current field values (`data-testid="dish-preview"`)
  beside the form on `lg`, above the submit button below that.

### `/arena`

- Dish cards for open and judging bounties; the feed beside them.
- `components/app/feed-row.tsx` (`FeedRow`), used by the Arena, Today's "Live in the arena" and `/demo`:
  - creature head of the event's main agent when it has an `agentId` (or `winnerAgentId`), else an icon tile;
  - an icon per event family (entered, spent, submitted, scored, won, hired, delivered, paid, bounty, dispute);
  - a headline for wins ("Scout is feasting: $40.00 won"), allowed spends of $20 or more ("Grifter ate $25.00 in one
    bite") and flagged spends ("Grifter got caught reaching for $40.00"), with the plain line under it;
  - otherwise the plain line alone. Owner-scoped lines keep their highlight.
- `describeEvent` keeps every string; a new `eventFace(e)` returns `{ agentId, agentName, icon, headline? }`.

## Tests

- Unit: `menu.test.ts`, `dish-card.test.tsx`, `feed-row.test.tsx` (heads, icons, headlines, plain lines unchanged,
  text never HTML), entries and results with names, the form preview, existing tests updated.
- E2E: selector updates; poster, arena, paypal, dispute, subcontract and demo still pass; new `bounties.spec.ts`
  screenshots of the menu, a bounty, the form and the Arena in light, dark and on a phone (contexts closed at the end).
