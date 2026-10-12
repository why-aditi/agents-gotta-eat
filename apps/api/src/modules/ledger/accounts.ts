export const PLATFORM_FEES = "platform:fees";
export const PAYPAL_CLEARING = "paypal:clearing";

export const walletAccount = (ownerId: string) => `wallet:${ownerId}`;
export const holdAccount = (spendRequestId: string) => `hold:${spendRequestId}`;
