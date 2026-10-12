// Step 8: cancel an UNCLAIMED payout item. Usage: pnpm cancel-item --item <payout_item_id>
import { main, paypal, report, requireArg } from "./lib";

interface PayoutItemResponse {
  payout_item_id?: string;
  transaction_status?: string;
  errors?: unknown;
}

main(async () => {
  const itemId = requireArg("item");
  const res = await paypal<PayoutItemResponse>(
    "POST",
    `/v1/payments/payouts-item/${itemId}/cancel`,
    undefined,
    "cancel-item",
  );
  report(`cancel payout item ${itemId}`, res);
  if (!res.ok) return;
  console.log(`  transaction_status: ${res.body.transaction_status ?? "?"}`);
  if (res.body.errors !== undefined) console.log(`  errors: ${JSON.stringify(res.body.errors)}`);
});
