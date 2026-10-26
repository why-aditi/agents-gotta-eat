"use server";

// Poster and admin actions on one bounty: fund (PayPal and dev), cancel and pick. Each sends the Idempotency-Key its form made
// when it rendered, so a double click replays instead of repeating.
import { Bounty, BountyResults, FundBountyResponse, PickWinnerRequest } from "@gottaeat/schemas";
import { revalidatePath } from "next/cache";
import { type ActionResult, runAction } from "@/lib/actions";
import { apiFetch } from "@/lib/api";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const KEY_RE = /^[A-Za-z0-9-]{8,200}$/;
const invalid = (message: string) => ({ ok: false as const, code: "validation_failed", message });

function check(bountyId: string, idempotencyKey: string) {
  if (!ID_RE.test(bountyId)) return invalid("Unknown bounty.");
  if (!KEY_RE.test(idempotencyKey)) return invalid("Missing idempotency key. Reload the page and try again.");
  return null;
}

function revalidate(bountyId: string) {
  revalidatePath(`/bounties/${bountyId}`);
  revalidatePath("/bounties");
}

// Dev stand-in for PayPal funding (pm-04). The api answers 404 unless it runs with ALLOW_DEV_FUNDING=true.
export async function fundBountyDev(bountyId: string, idempotencyKey: string): Promise<ActionResult<Bounty>> {
  const bad = check(bountyId, idempotencyKey);
  if (bad) return bad;
  const result = await runAction(() =>
    apiFetch(Bounty, `/v1/admin/bounties/${encodeURIComponent(bountyId)}/open`, { body: {}, idempotencyKey }),
  );
  if (result.ok) revalidate(bountyId);
  return result;
}

// PayPal funding, step 1: the api creates an AUTHORIZE order for the amount it computes (reward + fee) and gives
// back only the order id. Nothing from the browser decides the amount.
export async function startFunding(
  bountyId: string,
  idempotencyKey: string,
): Promise<ActionResult<FundBountyResponse>> {
  const bad = check(bountyId, idempotencyKey);
  if (bad) return bad;
  return runAction(() =>
    apiFetch(FundBountyResponse, `/v1/bounties/${encodeURIComponent(bountyId)}/fund`, {
      method: "POST",
      idempotencyKey,
    }),
  );
}

// Step 2, after the poster approved the order with PayPal: the api authorizes it and opens the bounty.
export async function confirmBountyFunding(bountyId: string, idempotencyKey: string): Promise<ActionResult<Bounty>> {
  const bad = check(bountyId, idempotencyKey);
  if (bad) return bad;
  const result = await runAction(() =>
    apiFetch(Bounty, `/v1/bounties/${encodeURIComponent(bountyId)}/fund/confirm`, {
      method: "POST",
      idempotencyKey,
    }),
  );
  if (result.ok) revalidate(bountyId);
  return result;
}

export async function cancelBounty(bountyId: string, idempotencyKey: string): Promise<ActionResult<Bounty>> {
  const bad = check(bountyId, idempotencyKey);
  if (bad) return bad;
  const result = await runAction(() =>
    apiFetch(Bounty, `/v1/bounties/${encodeURIComponent(bountyId)}/cancel`, { method: "POST", idempotencyKey }),
  );
  if (result.ok) revalidate(bountyId);
  return result;
}

export async function pickWinner(
  bountyId: string,
  entryId: string,
  idempotencyKey: string,
): Promise<ActionResult<BountyResults>> {
  const bad = check(bountyId, idempotencyKey);
  if (bad) return bad;
  const body = PickWinnerRequest.safeParse({ entryId });
  if (!body.success || !ID_RE.test(entryId)) return invalid("Unknown entry.");
  const result = await runAction(() =>
    apiFetch(BountyResults, `/v1/bounties/${encodeURIComponent(bountyId)}/pick`, {
      body: body.data,
      idempotencyKey,
    }),
  );
  if (result.ok) revalidate(bountyId);
  return result;
}
