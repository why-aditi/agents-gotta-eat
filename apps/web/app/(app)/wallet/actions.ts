"use server";

// Wallet actions: PayPal top-ups and withdrawals, the payout email, and dev credit (admin-only demo money; the api
// answers 404 when ALLOW_DEV_CREDIT is off). Money POSTs send the Idempotency-Key the card made for that amount.
import {
  DevCreditRequest,
  Payout,
  PayoutEmail,
  PayoutEmailRequest,
  Topup,
  TopupRequest,
  TopupResponse,
  Wallet,
  WithdrawalRequest,
} from "@gottaeat/schemas";
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

const badKey = () => invalid("Missing idempotency key. Reload the page and try again.");

// Step 1 of a top-up: the api creates a CAPTURE order and returns the ids. The minimum ($1.00) is the api's call.
export async function createTopup(amountCents: number, idempotencyKey: string): Promise<ActionResult<TopupResponse>> {
  const body = TopupRequest.safeParse({ amountCents });
  if (!body.success) return invalid("Enter an amount above $0.00.");
  if (!KEY_RE.test(idempotencyKey)) return badKey();
  return runAction(() => apiFetch(TopupResponse, "/v1/wallet/topups", { body: body.data, idempotencyKey }));
}

// Step 2, after PayPal approved the order: the api captures it. `status` says whether the money has cleared.
export async function confirmTopup(topupId: string, idempotencyKey: string): Promise<ActionResult<Topup>> {
  if (!ID_RE.test(topupId)) return invalid("Unknown top-up.");
  if (!KEY_RE.test(idempotencyKey)) return badKey();
  const result = await runAction(() =>
    apiFetch(Topup, `/v1/wallet/topups/${encodeURIComponent(topupId)}/confirm`, { method: "POST", idempotencyKey }),
  );
  if (result.ok) revalidatePath("/wallet");
  return result;
}

export async function savePayoutEmail(email: string): Promise<ActionResult<PayoutEmail>> {
  const body = PayoutEmailRequest.safeParse({ email: email.trim() });
  if (!body.success) return invalid("Enter a valid PayPal email address.");
  const result = await runAction(() =>
    apiFetch(PayoutEmail, "/v1/wallet/payout-email", { method: "PUT", body: body.data }),
  );
  if (result.ok) revalidatePath("/wallet");
  return result;
}

// The api answers 202 with the pending Payout; PayPal reports the outcome later by webhook.
export async function requestWithdrawal(amountCents: number, idempotencyKey: string): Promise<ActionResult<Payout>> {
  const body = WithdrawalRequest.safeParse({ amountCents });
  if (!body.success) return invalid("Enter an amount above $0.00.");
  if (!KEY_RE.test(idempotencyKey)) return badKey();
  const result = await runAction(() => apiFetch(Payout, "/v1/wallet/withdrawals", { body: body.data, idempotencyKey }));
  if (result.ok) revalidatePath("/wallet");
  return result;
}
