// PayPal-backed money in and out of an owner's wallet. Amounts are integer cents.
import { z } from "zod";

// Minimums ($1.00 top-up, $5.00 withdrawal) are checked by the server: 422 below_minimum.
export const TopupRequest = z.object({ amountCents: z.int().positive() });
export type TopupRequest = z.infer<typeof TopupRequest>;

// The browser only ever gets ids: it approves the order with PayPal, then calls confirm.
export const TopupResponse = z.object({ topupId: z.string(), orderId: z.string() });
export type TopupResponse = z.infer<typeof TopupResponse>;

export const TopupStatus = z.enum(["created", "captured", "failed"]);
export type TopupStatus = z.infer<typeof TopupStatus>;

export const Topup = z.object({ id: z.string(), amountCents: z.int(), status: TopupStatus });
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
