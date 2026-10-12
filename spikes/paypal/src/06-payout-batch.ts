// Step 6: Payouts batch of 3 x 100 cents: the two SPIKE_PAYEE_EMAILS plus an unclaimed email.
// Usage: pnpm payout
import { formatCents, loadState, main, paypal, report, requireEnv, saveState } from "./lib";

const ITEM_CENTS = 100n;

interface PayoutBatchResponse {
  batch_header?: { payout_batch_id?: string; batch_status?: string };
}

main(async () => {
  const payees = requireEnv("SPIKE_PAYEE_EMAILS")
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
  if (payees.length !== 2) throw new Error(`SPIKE_PAYEE_EMAILS must list exactly 2 emails, got ${payees.length}`);
  const ts = Date.now();
  const unclaimed = process.env.SPIKE_UNCLAIMED_EMAIL?.trim() || `nobody-${ts}@example.com`;
  const receivers = [...payees, unclaimed];

  const res = await paypal<PayoutBatchResponse>(
    "POST",
    "/v1/payments/payouts",
    {
      sender_batch_header: {
        sender_batch_id: `spike-${ts}`,
        email_subject: "gottaeat spike payout",
        email_message: "Sandbox test payout from the gottaeat PayPal spike.",
      },
      items: receivers.map((receiver, i) => ({
        recipient_type: "EMAIL",
        amount: { value: formatCents(ITEM_CENTS), currency: "USD" },
        receiver,
        note: "gottaeat spike",
        sender_item_id: `spike-${ts}-${i + 1}`,
      })),
    },
    "payout-batch",
  );
  report(`payout batch of ${receivers.length} x ${formatCents(ITEM_CENTS)} USD`, res);
  if (!res.ok) return;

  const batchId = res.body.batch_header?.payout_batch_id;
  console.log(`  receivers: ${receivers.join(", ")} (last one should end UNCLAIMED)`);
  console.log(`  batch id: ${batchId ?? "(absent)"} (status ${res.body.batch_header?.batch_status ?? "?"})`);
  if (batchId) {
    const state = loadState();
    state.payoutBatches.push(batchId);
    saveState(state);
    console.log(`  next: pnpm payout-status --batch ${batchId}`);
  }
});
