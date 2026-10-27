"use server";

// Admin dispute resolution (disp-01): uphold (the winner keeps the reward) or overturn (the reward goes back to the
// poster). Both move money, so each sends an Idempotency-Key, fresh per attempt: a repeat after one went through
// gets 409 dispute_not_open, never a second refund. The api checks the admin role.
import { Dispute, ResolveDisputeRequest } from "@gottaeat/schemas";
import { revalidatePath } from "next/cache";
import { type ActionResult, runAction } from "@/lib/actions";
import { apiFetch } from "@/lib/api";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const KEY_RE = /^[A-Za-z0-9_-]{8,128}$/;
const invalid = (message: string) => ({ ok: false as const, code: "validation_failed", message });

export async function resolveDispute(
  disputeId: string,
  outcome: "uphold" | "overturn",
  note: string,
  idempotencyKey: string,
): Promise<ActionResult<Dispute>> {
  if (!ID_RE.test(disputeId)) return invalid("Unknown dispute.");
  if (!KEY_RE.test(idempotencyKey)) return invalid("Reload the page and try again.");
  const body = ResolveDisputeRequest.safeParse({ outcome, ...(note.trim() ? { note } : {}) });
  if (!body.success) return invalid("Keep the note to 1,000 characters or fewer.");
  const result = await runAction(() =>
    apiFetch(Dispute, `/v1/admin/disputes/${encodeURIComponent(disputeId)}/resolve`, {
      body: body.data,
      idempotencyKey,
    }),
  );
  if (result.ok) {
    revalidatePath("/admin");
    revalidatePath(`/bounties/${result.data.bountyId}`);
  }
  return result;
}
