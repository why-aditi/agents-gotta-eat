"use server";

// Approve or deny a pending spend. Each card sends the Idempotency-Key it generated when it rendered, one per
// decision, so a double click replays instead of deciding twice.
import { ApprovalRequest, SpendRequest } from "@gottaeat/schemas";
import { type ActionResult, runAction } from "@/lib/actions";
import { apiFetch } from "@/lib/api";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const KEY_RE = /^[A-Za-z0-9-]{8,200}$/;
const invalid = (message: string) => ({ ok: false as const, code: "validation_failed", message });

async function decideSpend(
  spendRequestId: string,
  decision: "approve" | "deny",
  idempotencyKey: string,
): Promise<ActionResult<SpendRequest>> {
  if (!ID_RE.test(spendRequestId)) return invalid("Unknown spend request.");
  const body = ApprovalRequest.safeParse({ decision });
  if (!body.success) return invalid("Choose approve or deny.");
  if (!KEY_RE.test(idempotencyKey)) return invalid("Missing idempotency key. Reload the page and try again.");
  const result = await runAction(() =>
    apiFetch(SpendRequest, `/v1/approvals/${encodeURIComponent(spendRequestId)}`, {
      body: body.data,
      idempotencyKey,
    }),
  );
  // No revalidatePath here: it would re-render the page with the action's response and drop the card before its
  // stamp shows. The card calls router.refresh() itself once the stamp has landed, which also updates the nav badge.
  return result;
}

export async function approveSpend(spendRequestId: string, idempotencyKey: string) {
  return decideSpend(spendRequestId, "approve", idempotencyKey);
}

export async function denySpend(spendRequestId: string, idempotencyKey: string) {
  return decideSpend(spendRequestId, "deny", idempotencyKey);
}
