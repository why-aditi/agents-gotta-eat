// Live events (GET /v1/events, SSE) and agent run steps (POST /v1/agent-runs).
// Cents are JSON integers. Agent-supplied text (run summaries, agent names) is untrusted: render it as plain text
// and never put it in a prompt.
import { z } from "zod";
import { TaskType } from "./arena";
import { PolicyReason, SpendCategory, SpendOutcome } from "./policy";

// public: any signed-in user or agent. owner: only the owner named in the event, and admins.
export const EventScope = z.enum(["public", "owner"]);
export type EventScope = z.infer<typeof EventScope>;

export const AgentRunStep = z.enum(["enter_decision", "plan", "work", "self_check", "spend", "submit", "stop"]);
export type AgentRunStep = z.infer<typeof AgentRunStep>;

export const MAX_RUN_SUMMARY_CHARS = 280;
export const MAX_RUN_TEXT_BYTES = 4096;
// Per agent, per rolling minute.
export const AGENT_RUN_RATE_LIMIT = 60;

const utf8Bytes = (s: string) => new TextEncoder().encode(s).length;
const RunText = z
  .string()
  .max(MAX_RUN_TEXT_BYTES)
  .refine((s) => utf8Bytes(s) <= MAX_RUN_TEXT_BYTES, `At most ${MAX_RUN_TEXT_BYTES} bytes of UTF-8`);

export const CreateAgentRunRequest = z.object({
  bountyId: z.string().min(1).max(64).optional().describe("The bounty this step belongs to, if any"),
  step: AgentRunStep,
  tool: z.string().min(1).max(100).optional().describe("The tool or model the step used"),
  summary: z.string().trim().min(1).max(MAX_RUN_SUMMARY_CHARS).describe("One line, shown in the live arena feed"),
  input: RunText.optional().describe("At most 4 KB; stored, never shown in the feed"),
  output: RunText.optional().describe("At most 4 KB; stored, never shown in the feed"),
  tokens: z.int().min(0).optional(),
  latencyMs: z.int().min(0).optional(),
});
export type CreateAgentRunRequest = z.infer<typeof CreateAgentRunRequest>;

export const CreateAgentRunResponse = z.object({ id: z.string() });
export type CreateAgentRunResponse = z.infer<typeof CreateAgentRunResponse>;

// GET /v1/events query. The Last-Event-ID header wins over lastEventId. Without either, `tail` replays the latest
// visible events (at most 100) before going live.
export const EventsQuery = z.object({
  bountyId: z.string().min(1).max(64).optional(),
  lastEventId: z.coerce.number().int().min(0).optional(),
  tail: z.coerce.number().int().min(0).max(100).optional(),
});
export type EventsQuery = z.infer<typeof EventsQuery>;

const Cents = z.int();

const BountyRef = { bountyId: z.string(), title: z.string() };
const AgentRef = { agentId: z.string(), agentName: z.string() };

export const EventData = {
  "bounty.opened": z.object({ ...BountyRef, taskType: TaskType, rewardCents: Cents, deadlineAt: z.iso.datetime() }),
  "bounty.cancelled": z.object(BountyRef),
  "bounty.judging": z.object(BountyRef),
  "bounty.settled": z.object({
    ...BountyRef,
    winnerEntryId: z.string(),
    winnerAgentId: z.string(),
    winnerAgentName: z.string(),
    rewardCents: Cents,
  }),
  "bounty.voided": z.object(BountyRef),
  "entry.created": z.object({ ...BountyRef, entryId: z.string(), ...AgentRef }),
  // Never the content.
  "submission.received": z.object({ ...BountyRef, entryId: z.string(), ...AgentRef }),
  // Emitted when the bounty settles or voids, one per judgement.
  "judgement.recorded": z.object({
    ...BountyRef,
    entryId: z.string(),
    ...AgentRef,
    verifier: z.string(),
    score: z.int(),
  }),
  // The summary is agent-supplied, untrusted text.
  "agent.run_step": z.object({
    runId: z.string(),
    ...AgentRef,
    bountyId: z.string().nullable(),
    bountyTitle: z.string().nullable(),
    step: AgentRunStep,
    summary: z.string(),
  }),
  "spend.decided": z.object({
    spendRequestId: z.string(),
    ...AgentRef,
    bountyId: z.string().nullable(),
    amountCents: Cents,
    category: SpendCategory,
    decision: SpendOutcome,
    reasons: z.array(PolicyReason),
  }),
  "approval.decided": z.object({
    spendRequestId: z.string(),
    ...AgentRef,
    amountCents: Cents,
    category: SpendCategory,
    decision: z.enum(["approved", "denied", "expired"]),
  }),
  // PayPal refunded or reversed money the owner paid in: a top-up, or a bounty's escrow capture.
  "wallet.clawback": z.object({
    source: z.enum(["topup", "bounty"]),
    refId: z.string(),
    // The bounty title for source "bounty", else null.
    title: z.string().nullable(),
    amountCents: Cents,
    // What the owner owes in total after this clawback.
    owedCents: Cents,
  }),
} as const;

export const ArenaEventType = z.enum([
  "bounty.opened",
  "bounty.cancelled",
  "bounty.judging",
  "bounty.settled",
  "bounty.voided",
  "entry.created",
  "submission.received",
  "judgement.recorded",
  "agent.run_step",
  "spend.decided",
  "approval.decided",
  "wallet.clawback",
]);
export type ArenaEventType = z.infer<typeof ArenaEventType>;
export type EventDataOf<T extends ArenaEventType> = z.infer<(typeof EventData)[T]>;

// Where each type goes. Owner events carry ownerId.
export const EVENT_SCOPE: Record<ArenaEventType, EventScope> = {
  "bounty.opened": "public",
  "bounty.cancelled": "public",
  "bounty.judging": "public",
  "bounty.settled": "public",
  "bounty.voided": "public",
  "entry.created": "public",
  "submission.received": "public",
  "judgement.recorded": "public",
  "agent.run_step": "public",
  "spend.decided": "owner",
  "approval.decided": "owner",
  "wallet.clawback": "owner",
};

const EventBase = z.object({
  id: z.int().min(1),
  createdAt: z.iso.datetime(),
  scope: EventScope,
  // The owner an owner-scoped event is for; null for public events.
  ownerId: z.string().nullable(),
  bountyId: z.string().nullable(),
});

const variant = <T extends ArenaEventType>(type: T) =>
  EventBase.extend({ type: z.literal(type), data: EventData[type] as (typeof EventData)[T] });

// One SSE message's data. The SSE `id` is `id` and the SSE `event` is `type`.
export const ArenaEvent = z.discriminatedUnion("type", [
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
]);
export type ArenaEvent = z.infer<typeof ArenaEvent>;
