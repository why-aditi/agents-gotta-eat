// Pure helpers for the demo replay: the banner line, and the bounty cards the replay builds from its own events. Titles and agent names are untrusted text; these return strings for React to render.
import type { BountyStatus, TaskType } from "@gottaeat/schemas";
import type { ArenaEvent, Recording } from "@gottaeat/schemas";

const DATE = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });

export function replayBanner(recording: Pick<Recording, "startedAt" | "source"> | null): string {
  if (!recording) return "Replay of a recorded run";
  const date = new Date(recording.startedAt);
  const recorded = Number.isNaN(date.getTime()) ? "" : ` · recorded ${DATE.format(date)}`;
  const rehearsal = recording.source === "import" ? " · rehearsal with a stand-in model" : "";
  return `Replay of a recorded run${recorded}${rehearsal}`;
}

// Recorded time as "m:ss".
export function formatOffset(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Only PayPal sandbox activity links are rendered as links; anything else is shown as text.
export function sandboxUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "www.sandbox.paypal.com" ? u.toString() : null;
  } catch {
    return null;
  }
}

export interface ReplayBounty {
  id: string;
  title: string;
  status: BountyStatus;
  taskType: TaskType | null;
  rewardCents: number | null;
  entries: number;
  winnerName: string | null;
}

// Bounty cards from the replayed events, in the order bounties first appear.
export function deriveBounties(events: readonly ArenaEvent[]): ReplayBounty[] {
  const byId = new Map<string, ReplayBounty>();
  const entryIds = new Map<string, Set<string>>();
  const get = (id: string, title: string) => {
    let b = byId.get(id);
    if (!b) {
      b = { id, title, status: "open", taskType: null, rewardCents: null, entries: 0, winnerName: null };
      byId.set(id, b);
    }
    return b;
  };
  for (const e of events) {
    switch (e.type) {
      case "bounty.opened": {
        const b = get(e.data.bountyId, e.data.title);
        Object.assign(b, { title: e.data.title, taskType: e.data.taskType, rewardCents: e.data.rewardCents });
        break;
      }
      case "entry.created": {
        const b = get(e.data.bountyId, e.data.title);
        const seen = entryIds.get(b.id) ?? new Set<string>();
        seen.add(e.data.entryId);
        entryIds.set(b.id, seen);
        b.entries = seen.size;
        break;
      }
      case "bounty.judging":
        get(e.data.bountyId, e.data.title).status = "judging";
        break;
      case "bounty.settled": {
        const b = get(e.data.bountyId, e.data.title);
        Object.assign(b, { status: "settled", winnerName: e.data.winnerAgentName, rewardCents: e.data.rewardCents });
        break;
      }
      case "bounty.voided":
        get(e.data.bountyId, e.data.title).status = "voided";
        break;
      case "bounty.cancelled":
        get(e.data.bountyId, e.data.title).status = "cancelled";
        break;
      default:
        break;
    }
  }
  return [...byId.values()];
}
