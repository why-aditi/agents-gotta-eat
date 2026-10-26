// Demo replay schemas (demo-01). These mirror `packages/schemas/src/demo.ts` and the demo-01 changes to
// `packages/schemas/src/events.ts`, which land with the api side. When that merges, replace this file's exports
// with imports from `@gottaeat/schemas` (Recording, RecordingList, DemoStatus, MoneyLink, MoneyLinks, ReplayEvent,
// and ArenaEvent/ArenaEventType for FeedEvent/FEED_EVENT_TYPES) and delete it. Everything demo-specific the web
// parses lives here so the swap is mechanical.
import { ArenaEventType, EventData, EventScope, SpendCategory } from "@gottaeat/schemas";
import { z } from "zod";

const Cents = z.int();

// ---- packages/schemas/src/demo.ts ----

export const RecordingSource = z.enum(["live", "import"]);
export type RecordingSource = z.infer<typeof RecordingSource>;

export const Recording = z.object({
  id: z.string(),
  title: z.string(),
  notes: z.string().nullable(),
  startedAt: z.iso.datetime(),
  // Null while the recording is active.
  endedAt: z.iso.datetime().nullable(),
  eventCount: z.int().min(0),
  featured: z.boolean(),
  source: RecordingSource,
});
export type Recording = z.infer<typeof Recording>;

export const RecordingList = z.object({ recordings: z.array(Recording) });
export type RecordingList = z.infer<typeof RecordingList>;

export const StartRecordingRequest = z.object({ title: z.string().trim().min(1).max(200) });
export type StartRecordingRequest = z.infer<typeof StartRecordingRequest>;

export const SaveWindowRequest = z.object({
  title: z.string().trim().min(1).max(200),
  from: z.iso.datetime(),
  to: z.iso.datetime(),
});
export type SaveWindowRequest = z.infer<typeof SaveWindowRequest>;

export const DemoStatus = z.object({
  featured: Recording.nullable(),
  live: z.object({ budgetUsed: z.int().min(0), budget: z.int().min(0), fallback: z.boolean() }),
});
export type DemoStatus = z.infer<typeof DemoStatus>;

export const MoneyLinkKind = z.enum(["order", "authorization", "capture"]);
export type MoneyLinkKind = z.infer<typeof MoneyLinkKind>;

export const MoneyLink = z.object({
  bountyId: z.string(),
  bountyTitle: z.string(),
  kind: MoneyLinkKind,
  paypalId: z.string(),
  // Null for orders: there is no stable sandbox URL for an order.
  url: z.url().nullable(),
});
export type MoneyLink = z.infer<typeof MoneyLink>;

export const MoneyLinks = z.object({ links: z.array(MoneyLink) });
export type MoneyLinks = z.infer<typeof MoneyLinks>;

// ---- packages/schemas/src/events.ts (demo-01 additions) ----
// The same events as ArenaEvent, plus `demo.spend_flagged` and the optional PayPal ids on bounty.opened and
// bounty.settled. Once the api side merges, FeedEvent is ArenaEvent.

const FeedEventData = {
  ...EventData,
  "bounty.opened": EventData["bounty.opened"].extend({
    paypalOrderId: z.string().optional(),
    authorizationId: z.string().optional(),
  }),
  "bounty.settled": EventData["bounty.settled"].extend({ captureId: z.string().optional() }),
  // Gate 2 (the intent check) sent a spend to its owner. No reason text and no owner id: it is public.
  "demo.spend_flagged": z.object({
    agentId: z.string(),
    agentName: z.string(),
    amountCents: Cents,
    category: SpendCategory,
    bountyId: z.string().nullable(),
  }),
} as const;

export const FEED_EVENT_TYPES = [...ArenaEventType.options, "demo.spend_flagged"] as const;
export type FeedEventType = (typeof FEED_EVENT_TYPES)[number];

const EventBase = z.object({
  id: z.int().min(1),
  createdAt: z.iso.datetime(),
  scope: EventScope,
  ownerId: z.string().nullable(),
  bountyId: z.string().nullable(),
});

const variant = <T extends FeedEventType>(type: T) =>
  EventBase.extend({ type: z.literal(type), data: FeedEventData[type] as (typeof FeedEventData)[T] });

export const FeedEvent = z.discriminatedUnion("type", [
  variant("bounty.opened"),
  variant("bounty.cancelled"),
  variant("bounty.judging"),
  variant("bounty.settled"),
  variant("bounty.voided"),
  variant("entry.created"),
  variant("submission.received"),
  variant("judgement.recorded"),
  variant("agent.run_step"),
  variant("spend.decided"),
  variant("approval.decided"),
  variant("wallet.clawback"),
  variant("demo.spend_flagged"),
]);
export type FeedEvent = z.infer<typeof FeedEvent>;

// One replay SSE message's data: `id: <seq>`, `event: <type>`, `data: {"offsetMs":…, "event": …}`.
export const ReplayEvent = z.object({ offsetMs: z.int().min(0), event: FeedEvent });
export type ReplayEvent = z.infer<typeof ReplayEvent>;

export const REPLAY_SPEEDS = [1, 4] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];
