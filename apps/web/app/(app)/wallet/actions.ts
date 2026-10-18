"use server";

// Dev credit: admin-only demo money until PayPal top-ups land. The api answers 404 when ALLOW_DEV_CREDIT is off.
import { DevCreditRequest, Wallet } from "@gottaeat/schemas";
import { revalidatePath } from "next/cache";
import { type ActionResult, runAction } from "@/lib/actions";
import { apiFetch } from "@/lib/api";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const KEY_RE = /^[A-Za-z0-9-]{8,200}$/;
const invalid = (message: string) => ({ ok: false as const, code: "validation_failed", message });

export async function addDevCredit(
  userId: string,
  amountCents: number,
  idempotencyKey: string,
): Promise<ActionResult<Wallet>> {
  if (!ID_RE.test(userId)) return invalid("Unknown user.");
  const body = DevCreditRequest.safeParse({ amountCents });
  if (!body.success) return invalid("Enter an amount above $0.00.");
  if (!KEY_RE.test(idempotencyKey)) return invalid("Missing idempotency key. Reload the page and try again.");
  const result = await runAction(() =>
    apiFetch(Wallet, `/v1/admin/wallets/${encodeURIComponent(userId)}/credit`, { body: body.data, idempotencyKey }),
  );
  if (result.ok) revalidatePath("/wallet");
  return result;
}
