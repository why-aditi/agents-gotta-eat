// Step 7: batch and item status. Usage: pnpm payout-status [--batch <id>] (defaults to the last batch)
import { arg, loadState, main, paypal, report } from "./lib";

interface PayoutItem {
  payout_item_id?: string;
  transaction_status?: string;
  transaction_id?: string;
  payout_item?: { receiver?: string; amount?: { value?: string; currency?: string } };
  errors?: unknown;
}

interface PayoutStatusResponse {
  batch_header?: { payout_batch_id?: string; batch_status?: string };
  items?: PayoutItem[];
}

main(async () => {
  const batchId = arg("batch") ?? loadState().payoutBatches.at(-1);
  if (!batchId) throw new Error("Missing --batch and no batch in out/state.json");

  const res = await paypal<PayoutStatusResponse>("GET", `/v1/payments/payouts/${batchId}`, undefined, "payout-status");
  report(`payout batch ${batchId}`, res);
  if (!res.ok) return;

  console.log(`  batch_status: ${res.body.batch_header?.batch_status ?? "?"}`);
  for (const item of res.body.items ?? []) {
    const amount = item.payout_item?.amount;
    console.log(
      `  item ${item.payout_item_id ?? "?"}: ${item.transaction_status ?? "?"} -> ${item.payout_item?.receiver ?? "?"}` +
        ` (${amount?.value ?? "?"} ${amount?.currency ?? ""})`,
    );
    if (item.errors !== undefined) console.log(`    errors: ${JSON.stringify(item.errors)}`);
  }
});
