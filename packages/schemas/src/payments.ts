// PayPal-backed money in and out of an owner's wallet. Amounts are integer cents.
import { z } from "zod";

export const MIN_TOPUP_CENTS = 100;
// $10,000. Keeps the fee maths far inside safe integers.
export const MAX_TOPUP_CENTS = 1_000_000;

// PayPal's US rate on a top-up: 3.49% + 49¢. The owner picks the wallet credit and pays credit + fee, where the
// fee grosses up PayPal's rate so the platform nets at least the credit.
export const TOPUP_FEE_BPS = 349;
export const TOPUP_FEE_FIXED_CENTS = 49;

// ceil(a / b) for non-negative safe integers, without float division.
function ceilDiv(a: number, b: number): number {
  const q = (a - (a % b)) / b;
  return a % b === 0 ? q : q + 1;
}

// The fee on a top-up that credits `creditCents`: charge = ceil((credit + 49) * 10000 / (10000 - 349)),
// fee = charge - credit. Integer maths only. $5.00 → fee $0.69 (charge $5.69). Throws below $1.00, above
// MAX_TOPUP_CENTS and on anything that is not an integer.
export function topupFeeCents(creditCents: number): number {
  if (!Number.isSafeInteger(creditCents) || creditCents < MIN_TOPUP_CENTS || creditCents > MAX_TOPUP_CENTS) {
    throw new RangeError(`top-up credit must be an integer from ${MIN_TOPUP_CENTS} to ${MAX_TOPUP_CENTS} cents`);
  }
  const charge = ceilDiv((creditCents + TOPUP_FEE_FIXED_CENTS) * 10_000, 10_000 - TOPUP_FEE_BPS);
  return charge - creditCents;
}

// `amountCents` is the wallet credit. Minimums ($1.00 top-up, $5.00 withdrawal) are checked by the server:
// 422 below_minimum.
export const TopupRequest = z.object({ amountCents: z.int().positive().max(MAX_TOPUP_CENTS) });
export type TopupRequest = z.infer<typeof TopupRequest>;

// The browser only ever gets ids and the amounts the server decided: it approves the order (for totalCents =
// amountCents + feeCents) with PayPal, then calls confirm.
export const TopupResponse = z.object({
  topupId: z.string(),
  orderId: z.string(),
  feeCents: z.int(),
  totalCents: z.int(),
});
export type TopupResponse = z.infer<typeof TopupResponse>;

// refunded: PayPal refunded or reversed the whole charge. denied: PayPal denied a pending capture.
export const TopupStatus = z.enum(["created", "captured", "failed", "refunded", "denied"]);
export type TopupStatus = z.infer<typeof TopupStatus>;

// amountCents is the wallet credit, feeCents what PayPal's fee added to the charge.
export const Topup = z.object({ id: z.string(), amountCents: z.int(), feeCents: z.int(), status: TopupStatus });
export type Topup = z.infer<typeof Topup>;

export const WithdrawalRequest = z.object({ amountCents: z.int().positive() });
export type WithdrawalRequest = z.infer<typeof WithdrawalRequest>;

export const PayoutStatus = z.enum(["pending", "succeeded", "failed", "unclaimed", "returned", "canceled"]);
export type PayoutStatus = z.infer<typeof PayoutStatus>;

export const Payout = z.object({
  id: z.string(),
  amountCents: z.int(),
  status: PayoutStatus,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Payout = z.infer<typeof Payout>;

export const PayoutList = z.object({ payouts: z.array(Payout) });
export type PayoutList = z.infer<typeof PayoutList>;

// Where withdrawals are sent. Null until the owner sets it; withdrawals answer 409 no_paypal_email without it.
export const PayoutEmailRequest = z.object({ email: z.email().max(254) });
export type PayoutEmailRequest = z.infer<typeof PayoutEmailRequest>;

export const PayoutEmail = z.object({ email: z.string().nullable() });
export type PayoutEmail = z.infer<typeof PayoutEmail>;
