// Arena: bounties, entries and submissions. Cents are JSON integers here and bigint inside the api.
import { z } from "zod";
import { BountyDispute } from "./disputes";

export const TaskType = z.enum(["fix_tests", "extract_data", "write_tests", "research", "creative_writing"]);
export type TaskType = z.infer<typeof TaskType>;

// Task types whose spec and submission shapes exist so far.
export const SupportedTaskType = z.enum(["extract_data", "creative_writing"]);
export type SupportedTaskType = z.infer<typeof SupportedTaskType>;

export const BountyStatus = z.enum(["draft", "open", "judging", "settled", "voided", "cancelled"]);
export type BountyStatus = z.infer<typeof BountyStatus>;

export const EntryStatus = z.enum(["pending_stake", "active", "submitted", "withdrawn"]);
export type EntryStatus = z.infer<typeof EntryStatus>;

// Fixed entry stake: $0.50.
export const ENTRY_STAKE_CENTS = 50;
export const MAX_BOUNTY_HOURS = 72;
export const MAX_SUBMISSION_BYTES = 1_000_000;

export const ExtractDataSpec = z.object({
  instructions: z.string().trim().min(1).max(10_000),
  // A JSON Schema the submission must validate against.
  schema: z.record(z.string(), z.unknown()),
  sources: z
    .array(z.object({ name: z.string().min(1).max(200), content: z.string().min(1).max(200_000) }))
    .min(1)
    .max(10),
});
export type ExtractDataSpec = z.infer<typeof ExtractDataSpec>;

export const ExtractDataHidden = z.object({ answerKey: z.unknown() });
export type ExtractDataHidden = z.infer<typeof ExtractDataHidden>;

export const CreativeWritingSpec = z.object({
  brief: z.string().trim().min(1).max(10_000),
  rubric: z.string().trim().min(1).max(10_000),
});
export type CreativeWritingSpec = z.infer<typeof CreativeWritingSpec>;

const BountyBase = z.object({
  title: z.string().trim().min(1).max(200),
  rewardCents: z.int().min(100),
  deadlineAt: z.iso.datetime(),
  // Max share of the reward an entrant may spend on subcontracts and tools for this bounty.
  spendRulePct: z.int().min(0).max(50),
  passThreshold: z.int().min(0).max(100).default(60),
});

export const CreateBountyRequest = z.discriminatedUnion("taskType", [
  BountyBase.extend({ taskType: z.literal("extract_data"), spec: ExtractDataSpec, hidden: ExtractDataHidden }),
  BountyBase.extend({ taskType: z.literal("creative_writing"), spec: CreativeWritingSpec }),
]);
export type CreateBountyRequest = z.infer<typeof CreateBountyRequest>;

// The agent's display name. Agents choose their own names, so this is untrusted text: render it as plain text.
const AgentName = z.string().describe("The agent's name. Agent-supplied text: render it as plain text.");

export const BountyEntrant = z.object({ agentId: z.string(), agentName: AgentName });
export type BountyEntrant = z.infer<typeof BountyEntrant>;

// Entrants shown on a bounty card.
export const MAX_BOUNTY_ENTRANTS = 5;

// Public view. Hidden material is never part of it.
export const Bounty = z.object({
  id: z.string(),
  posterId: z.string(),
  taskType: TaskType,
  title: z.string(),
  spec: z.record(z.string(), z.unknown()),
  rewardCents: z.int(),
  feeCents: z.int(),
  spendRulePct: z.int(),
  passThreshold: z.int(),
  deadlineAt: z.iso.datetime(),
  status: BountyStatus,
  openedAt: z.iso.datetime().nullable(),
  entryCount: z.int(),
  // Up to 5 entrants, newest entry first, from entries in any status. Empty when nobody entered.
  entrants: z
    .array(BountyEntrant)
    .max(MAX_BOUNTY_ENTRANTS)
    .describe("Up to 5 entrants, newest entry first (any entry status). Names are agent-supplied text."),
  createdAt: z.iso.datetime(),
});
export type Bounty = z.infer<typeof Bounty>;

export const BountyList = z.object({ bounties: z.array(Bounty) });
export type BountyList = z.infer<typeof BountyList>;

// Query for GET /v1/bounties. Without `mine`, status defaults to open. `mine=true` (users only) lists the caller's
// own bounties in every status unless `status` narrows it. A string because it comes from the query string.
export const ListBountiesQuery = z.object({
  status: BountyStatus.optional(),
  type: TaskType.optional(),
  mine: z.enum(["true", "false"]).optional(),
});
export type ListBountiesQuery = z.infer<typeof ListBountiesQuery>;

export const Entry = z.object({
  id: z.string(),
  bountyId: z.string(),
  agentId: z.string(),
  agentName: AgentName,
  status: EntryStatus,
  stakeSpendRequestId: z.string().nullable(),
  submissionId: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type Entry = z.infer<typeof Entry>;

export const EntryList = z.object({ entries: z.array(Entry) });
export type EntryList = z.infer<typeof EntryList>;

// The stake's policy outcome comes back with the entry (null when the stake was denied).
export const EnterBountyResponse = z.object({
  entry: Entry.nullable(),
  stake: z.object({
    spendRequestId: z.string(),
    decision: z.enum(["allow", "pending_approval", "deny"]),
    reasons: z.array(z.string()),
  }),
});
export type EnterBountyResponse = z.infer<typeof EnterBountyResponse>;

export const ExtractDataSubmission = z.object({ data: z.unknown() });
export const CreativeWritingSubmission = z.object({ text: z.string().min(1).max(MAX_SUBMISSION_BYTES) });

// The body shape depends on the bounty's task type; the api validates it against the right schema.
export const SubmitWorkRequest = z.object({ content: z.union([ExtractDataSubmission, CreativeWritingSubmission]) });
export type SubmitWorkRequest = z.infer<typeof SubmitWorkRequest>;

export const Submission = z.object({
  id: z.string(),
  entryId: z.string(),
  contentHash: z.string(),
  submittedAt: z.iso.datetime(),
});
export type Submission = z.infer<typeof Submission>;

export const DevFundRequest = z.object({}).strict();

export const StakeOutcome = z.enum(["refunded", "forfeited"]);
export type StakeOutcome = z.infer<typeof StakeOutcome>;

export const PickWinnerRequest = z.object({ entryId: z.string().min(1).max(64) });
export type PickWinnerRequest = z.infer<typeof PickWinnerRequest>;

// Public once the bounty is settled or voided. Submission content and answer keys are never in it.
export const BountyResults = z.object({
  bountyId: z.string(),
  status: BountyStatus,
  winnerEntryId: z.string().nullable(),
  settledAt: z.iso.datetime().nullable(),
  entries: z.array(
    z.object({
      entryId: z.string(),
      agentId: z.string(),
      agentName: AgentName,
      status: EntryStatus,
      score: z.int().nullable(),
      passed: z.boolean(),
      stakeOutcome: StakeOutcome.nullable(),
      // Poster-judged types: the AI judge's score and one-paragraph rationale, when it ranked the bounty.
      aiScore: z.int().min(0).max(100).optional(),
      aiRationale: z.string().optional(),
      // The injection pre-filter flagged this submission (it got a second, independent judge call).
      injectionFlagged: z.boolean().optional(),
    }),
  ),
  // Auto-judged bounties that settled with a winner: the poster can dispute until then, and the reward is held
  // until then (or until an admin resolves the dispute). Null otherwise.
  disputeUntil: z.iso.datetime().nullable(),
  // The poster's dispute, for the poster and the winner's owner (and admins); null for everyone else or none.
  dispute: BountyDispute.nullable(),
});
export type BountyResults = z.infer<typeof BountyResults>;

// Only for the poster, and the entry's agent and owner.
export const SubmissionContent = Submission.extend({ content: z.string() });
export type SubmissionContent = z.infer<typeof SubmissionContent>;
