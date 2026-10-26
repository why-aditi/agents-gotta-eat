// Demo mode: recorded runs replayed to logged-out visitors (GET /v1/demo/*) and the admin controls that record,
// feature and reset them (/v1/admin/recordings, /v1/admin/demo/reset). Recordings hold public events only.
// Cents are JSON integers. Agent names and summaries in replays are untrusted text: render them as plain text.
import { z } from "zod";
import { ArenaEvent, ArenaEventType } from "./events";

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

const Title = z.string().trim().min(1).max(200);

export const StartRecordingRequest = z.object({ title: Title });
export type StartRecordingRequest = z.infer<typeof StartRecordingRequest>;

export const SaveWindowRequest = z
  .object({ title: Title, from: z.iso.datetime(), to: z.iso.datetime() })
  .refine((w) => Date.parse(w.from) < Date.parse(w.to), { message: "from must be before to", path: ["to"] });
export type SaveWindowRequest = z.infer<typeof SaveWindowRequest>;

// One message of GET /v1/demo/stream. The SSE `id` is the event's seq (also `event.id`), the SSE `event` its type.
// `event.createdAt` is the recording's start plus `offsetMs`.
export const ReplayEvent = z.object({ offsetMs: z.int().min(0), event: ArenaEvent });
export type ReplayEvent = z.infer<typeof ReplayEvent>;

export const DEMO_SPEEDS = [1, 4] as const;
export type DemoSpeed = (typeof DEMO_SPEEDS)[number];

export const DemoStreamQuery = z.object({
  // Defaults to the featured recording.
  recording: z.string().min(1).max(64).optional(),
  // 1 (real time, the default) or 4.
  speed: z.coerce
    .number()
    .int()
    .refine((v) => (DEMO_SPEEDS as readonly number[]).includes(v), "speed must be 1 or 4")
    .optional(),
  // Resume: skip events with seq <= from, and start timing from the next one.
  from: z.coerce.number().int().min(0).optional(),
});
export type DemoStreamQuery = z.infer<typeof DemoStreamQuery>;

export const DemoStatus = z.object({
  featured: Recording.nullable(),
  live: z.object({
    // Gateway requests sent today (UTC) and the daily budget.
    budgetUsed: z.int().min(0),
    budget: z.int().min(0),
    // True at 80% of the budget or more: send new visitors to the replay.
    fallback: z.boolean(),
  }),
});
export type DemoStatus = z.infer<typeof DemoStatus>;

export const MoneyLinkKind = z.enum(["order", "authorization", "capture"]);
export type MoneyLinkKind = z.infer<typeof MoneyLinkKind>;

export const MoneyLink = z.object({
  bountyId: z.string(),
  bountyTitle: z.string(),
  kind: MoneyLinkKind,
  paypalId: z.string(),
  // The sandbox activity page for authorizations and captures; null for orders (no stable sandbox URL).
  url: z.url().nullable(),
});
export type MoneyLink = z.infer<typeof MoneyLink>;

export const MoneyLinks = z.object({ links: z.array(MoneyLink) });
export type MoneyLinks = z.infer<typeof MoneyLinks>;

export const DemoResetResult = z.object({
  // Seed bounties created and opened by this reset.
  opened: z.array(z.object({ id: z.string(), title: z.string() })),
  // Seed bounty titles that were already open.
  skipped: z.array(z.string()),
  // What the house owner's wallet got to reach $60 (0 when it already had that, or there is no house owner).
  creditedCents: z.int().min(0),
});
export type DemoResetResult = z.infer<typeof DemoResetResult>;

// seed/recordings/*.json, loaded by `pnpm demo:import`. Public event types only.
export const RecordingFile = z.object({
  title: Title,
  notes: z.string().max(2000).nullable().optional(),
  source: z.literal("import"),
  // When the run was recorded; the import time when absent.
  startedAt: z.iso.datetime().optional(),
  events: z
    .array(
      z.object({
        offsetMs: z.int().min(0),
        type: ArenaEventType,
        bountyId: z.string().nullable(),
        data: z.unknown(),
      }),
    )
    .max(10_000),
});
export type RecordingFile = z.infer<typeof RecordingFile>;
