export const PLATFORM_FEES = "platform:fees";
export const PAYPAL_CLEARING = "paypal:clearing";

export const walletAccount = (ownerId: string) => `wallet:${ownerId}`;
export const holdAccount = (spendRequestId: string) => `hold:${spendRequestId}`;
// disp-01: an auto-judged winner's reward while the poster may still dispute it. Owned by the winner's owner, so it
// counts as held money they can't spend yet.
export const disputeHoldAccount = (bountyId: string) => `hold:dispute:${bountyId}`;
export const stakeAccount = (bountyId: string) => `stake:${bountyId}`;
export const withdrawalAccount = (payoutId: string) => `withdrawal:${payoutId}`;
// Asset: money the user owes the platform after a PayPal refund or reversal. Positive balance = frozen.
export const receivableAccount = (userId: string) => `receivable:${userId}`;
