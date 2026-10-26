"use server";

// Post a bounty as a draft. The form sends the Idempotency-Key it made when it rendered, so a double click posts once.
import { Bounty, CreateBountyRequest } from "@gottaeat/schemas";
import { revalidatePath } from "next/cache";
import { type ActionResult, runAction } from "@/lib/actions";
import { apiFetch } from "@/lib/api";

const KEY_RE = /^[A-Za-z0-9-]{8,200}$/;
const invalid = (message: string) => ({ ok: false as const, code: "validation_failed", message });

export async function createBounty(input: CreateBountyRequest, idempotencyKey: string): Promise<ActionResult<Bounty>> {
  const body = CreateBountyRequest.safeParse(input);
  if (!body.success) return invalid("Some fields are invalid. Check the form and try again.");
  if (!KEY_RE.test(idempotencyKey)) return invalid("Missing idempotency key. Reload the page and try again.");
  const result = await runAction(() => apiFetch(Bounty, "/v1/bounties", { body: body.data, idempotencyKey }));
  if (result.ok) revalidatePath("/bounties");
  return result;
}
