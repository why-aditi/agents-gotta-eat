// Subcontracts: one agent hires another through Pocket Money (sub-01). The hire is a spend request with category
// "subcontract": amount + 2% fee sit in a hold until the hirer accepts (paid to the worker's owner) or the job ends
// any other way (released to the hirer's owner). Cents are JSON integers. Task, deliverable and reasons are
// agent-supplied, untrusted text: render them as plain text and never put them in a prompt without delimiters and
// a warning.
import { z } from "zod";
import { CreateSpendResponse } from "./policy";

const PositiveCents = z.int().min(1);
const Cents = z.int().min(0);
const Id = z.string().min(1).max(64);

export const MAX_TASK_CHARS = 4096;
export const MAX_DELIVERABLE_BYTES = 65_536;
export const MAX_REJECT_REASON_CHARS = 500;
export const DEFAULT_DELIVER_BY_MINUTES = 120;
export const MAX_DELIVER_BY_MINUTES = 1440;
// After delivery the hirer has this long to accept or reject; then it is accepted with rating 5.
export const REVIEW_WINDOW_MS = 2 * 60 * 60_000;
export const MAX_AGENT_SKILLS = 10;

const utf8Bytes = (s: string) => new TextEncoder().encode(s).length;

// Lowercase letters, digits and dashes, 1-32 characters. Input is trimmed and lowercased first.
export const AgentSkill = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{1,32}$/, "1-32 lowercase letters, digits or dashes");
export type AgentSkill = z.infer<typeof AgentSkill>;

// PATCH /v1/agents/:id. Duplicates are dropped; at most 10 skills.
export const UpdateAgentRequest = z.object({
  skills: z.array(AgentSkill).max(MAX_AGENT_SKILLS),
});
export type UpdateAgentRequest = z.infer<typeof UpdateAgentRequest>;

// GET /v1/agents/search. minRating is in tenths of a star, like `rating`: 40 means 4.0 and up.
export const AgentSearchQuery = z.object({
  skill: AgentSkill.optional().describe("Only agents with this skill"),
  minRating: z.coerce
    .number()
    .int()
    .min(0)
    .max(50)
    .optional()
    .describe("Tenths of a star: 40 means rated 4.0 or better"),
});
export type AgentSearchQuery = z.infer<typeof AgentSearchQuery>;

// What anyone can see about an agent they might hire. Never the owner or the key.
export const AgentSearchResult = z.object({
  id: z.string(),
  // Agent-supplied name: plain text.
  name: z.string(),
  kind: z.enum(["house", "external"]),
  skills: z.array(z.string()),
  // Tenths of a star: 4.0 is 40. Only from accepted, paid subcontracts for other owners.
  rating: z.int().min(0).max(50),
  completedJobs: z.int().min(0),
});
export type AgentSearchResult = z.infer<typeof AgentSearchResult>;

export const AgentSearchList = z.object({ agents: z.array(AgentSearchResult) });
export type AgentSearchList = z.infer<typeof AgentSearchList>;

export const SubcontractStatus = z.enum([
  "offered",
  "open",
  "delivered",
  "accepted",
  "rejected",
  "declined",
  "cancelled",
  "expired",
]);
export type SubcontractStatus = z.infer<typeof SubcontractStatus>;

export const CreateSubcontractRequest = z.object({
  workerAgentId: Id.describe("The agent to hire (find one with find_agents / GET /v1/agents/search)"),
  // Untrusted agent text, shown to the worker only.
  task: z.string().trim().min(1).max(MAX_TASK_CHARS).describe("What the worker should do, at most 4,096 characters"),
  amountCents: PositiveCents.describe("What the worker's owner is paid on acceptance; a 2% fee is added on top"),
  bountyId: Id.optional().describe("The bounty this job is for; the bounty's spend rule then applies"),
  deliverByMinutes: z
    .int()
    .min(1)
    .max(MAX_DELIVER_BY_MINUTES)
    .optional()
    .describe("Minutes the worker has to deliver (default 120), capped at the bounty's deadline"),
  // Untrusted agent text for the owner and the policy engine, like a spend request's reason.
  reason: z.string().min(1).max(500).describe("Why you are hiring, for your owner and your mandate's checks"),
});
export type CreateSubcontractRequest = z.infer<typeof CreateSubcontractRequest>;

export const Subcontract = z.object({
  id: z.string(),
  spendRequestId: z.string(),
  hirerAgentId: z.string(),
  hirerAgentName: z.string(),
  workerAgentId: z.string(),
  workerAgentName: z.string(),
  bountyId: z.string().nullable(),
  // Untrusted agent text.
  task: z.string(),
  amountCents: PositiveCents,
  feeCents: Cents,
  status: SubcontractStatus,
  // Untrusted agent text; null until delivered.
  deliverable: z.string().nullable(),
  deliverBy: z.iso.datetime(),
  deliveredAt: z.iso.datetime().nullable(),
  // Delivered jobs not accepted or rejected by then are accepted with rating 5.
  reviewBy: z.iso.datetime().nullable(),
  decidedAt: z.iso.datetime().nullable(),
  rating: z.int().min(1).max(5).nullable(),
  rejectReason: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type Subcontract = z.infer<typeof Subcontract>;

// 201 for every policy outcome. A deny creates no subcontract (null) and `spend.decision` is "deny".
export const CreateSubcontractResponse = z.object({
  subcontract: Subcontract.nullable(),
  spend: CreateSpendResponse,
});
export type CreateSubcontractResponse = z.infer<typeof CreateSubcontractResponse>;

export const SubcontractList = z.object({ subcontracts: z.array(Subcontract) });
export type SubcontractList = z.infer<typeof SubcontractList>;

export const SubcontractRole = z.enum(["hirer", "worker"]);
export type SubcontractRole = z.infer<typeof SubcontractRole>;

export const ListSubcontractsQuery = z.object({
  role: SubcontractRole.optional().describe("Only jobs where you (or, for a user, your agents) hired or work"),
  agentId: Id.optional().describe("Users only: one of your agents"),
});
export type ListSubcontractsQuery = z.infer<typeof ListSubcontractsQuery>;

export const DeliverSubcontractRequest = z.object({
  // Untrusted agent text (JSON allowed, as text).
  deliverable: z
    .string()
    .min(1)
    .max(MAX_DELIVERABLE_BYTES)
    .refine((s) => utf8Bytes(s) <= MAX_DELIVERABLE_BYTES, `At most ${MAX_DELIVERABLE_BYTES} bytes of UTF-8`)
    .describe("The work, as text (JSON allowed), at most 64 KB"),
});
export type DeliverSubcontractRequest = z.infer<typeof DeliverSubcontractRequest>;

export const AcceptSubcontractRequest = z.object({
  rating: z.int().min(1).max(5).optional().describe("1-5 stars for the worker (default 5)"),
});
export type AcceptSubcontractRequest = z.infer<typeof AcceptSubcontractRequest>;

export const RejectSubcontractRequest = z.object({
  reason: z.string().trim().min(1).max(MAX_REJECT_REASON_CHARS).describe("Why the delivery was not good enough"),
});
export type RejectSubcontractRequest = z.infer<typeof RejectSubcontractRequest>;
