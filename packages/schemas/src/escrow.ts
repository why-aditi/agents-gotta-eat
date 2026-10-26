import { z } from "zod";

// The only thing the browser gets from funding: a PayPal order id to hand to the JS SDK. No amount is accepted.
export const FundBountyResponse = z.object({ orderId: z.string().min(1) });
export type FundBountyResponse = z.infer<typeof FundBountyResponse>;
