export const PLATFORM_FEES = "platform:fees";
export const PAYPAL_CLEARING = "paypal:clearing";

export const walletAccount = (ownerId: string) => `wallet:${ownerId}`;
export const holdAccount = (spendRequestId: string) => `hold:${spendRequestId}`;
export const stakeAccount = (bountyId: string) => `stake:${bountyId}`;
export const withdrawalAccount = (payoutId: string) => `withdrawal:${payoutId}`;
// Asset: money the user owes the platform after a PayPal refund or reversal. Positive balance = frozen.
export const receivableAccount = (userId: string) => `receivable:${userId}`;
