// Disputes (disp-01): the poster of an auto-judged bounty disputes the result within 12 hours of settlement; an admin
// upholds it (the winner keeps the reward) or overturns it (the reward goes back to the poster, the fee stays).
// Cents are JSON integers. The reason is poster-supplied, untrusted text: render it as plain text and never put
// it in a prompt or an event.
import { z } from "zod";

export const DISPUTE_WINDOW_HOURS = 12;
export const DISPUTE_WINDOW_MS = DISPUTE_WINDOW_HOURS * 3_600_000;
export const MAX_DISPUTE_REASON_CHARS = 1000;
export const MAX_DISPUTE_NOTE_CHARS = 1000;

export const DisputeStatus = z.enum(["open", "upheld", "overturned"]);
export type DisputeStatus = z.infer<typeof DisputeStatus>;

export const DisputeOutcome = z.enum(["uphold", "overturn"]);
export type DisputeOutcome = z.infer<typeof DisputeOutcome>;

// POST /v1/bounties/:id/disputes.
export const CreateDisputeRequest = z.object({
  reason: z.string().trim().min(1).max(MAX_DISPUTE_REASON_CHARS).describe("Why the result is wrong. Plain text"),
});
export type CreateDisputeRequest = z.infer<typeof CreateDisputeRequest>;

// POST /v1/admin/disputes/:id/resolve.
export const ResolveDisputeRequest = z.object({
  outcome: DisputeOutcome.describe("uphold: the winner keeps the reward; overturn: the reward goes back to the poster"),
  note: z.string().trim().max(MAX_DISPUTE_NOTE_CHARS).optional().describe("Shown to the poster and the winner"),
});
export type ResolveDisputeRequest = z.infer<typeof ResolveDisputeRequest>;

// GET /v1/admin/disputes.
export const AdminDisputesQuery = z.object({ status: DisputeStatus.optional() });
export type AdminDisputesQuery = z.infer<typeof AdminDisputesQuery>;

export const Dispute = z.object({
  id: z.string(),
  bountyId: z.string(),
  // Poster-written: plain text.
  bountyTitle: z.string(),
  posterId: z.string(),
  // Poster-written, untrusted: plain text.
  reason: z.string(),
  status: DisputeStatus,
  openedAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
  note: z.string().nullable(),
  // The PayPal refund id, for an overturned dispute on a real (PayPal) escrow.
  refundId: z.string().nullable(),
  // The disputed reward (what an overturn refunds).
  rewardCents: z.int(),
});
export type Dispute = z.infer<typeof Dispute>;

export const DisputeList = z.object({ items: z.array(Dispute) });
export type DisputeList = z.infer<typeof DisputeList>;

// The dispute on a bounty's results, for its poster and the winner's owner.
export const BountyDispute = z.object({
  id: z.string(),
  status: DisputeStatus,
  // Poster-written, untrusted: plain text.
  reason: z.string(),
  openedAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
  note: z.string().nullable(),
});
export type BountyDispute = z.infer<typeof BountyDispute>;
