// Step 4: capture. Usage: pnpm capture --label A
// AUTHORIZE orders capture the current authorization id; CAPTURE-intent orders capture the order.
import { loadState, main, paypal, report, requireArg, requireLabel, saveState } from "./lib";

interface CaptureResponse {
  id?: string;
  status?: string;
  purchase_units?: { payments?: { captures?: { id?: string; status?: string }[] } }[];
}

main(async () => {
  const label = requireArg("label");
  const state = loadState();
  const entry = requireLabel(state, label);

  let captureId: string | undefined;
  let status: string | undefined;
  if (entry.intent === "CAPTURE") {
    const res = await paypal<CaptureResponse>(
      "POST",
      `/v2/checkout/orders/${entry.orderId}/capture`,
      undefined,
      `capture-order-${label}`,
    );
    report(`capture order ${entry.orderId} (label ${label})`, res);
    if (!res.ok) return;
    const capture = res.body.purchase_units?.[0]?.payments?.captures?.[0];
    captureId = capture?.id;
    status = capture?.status;
  } else {
    const auth = entry.authorization;
    if (!auth) throw new Error(`Label ${label} has no authorization. Run: pnpm authorize --label ${label}`);
    const res = await paypal<CaptureResponse>(
      "POST",
      `/v2/payments/authorizations/${auth.id}/capture`,
      { final_capture: true },
      `capture-${label}`,
    );
    report(`capture authorization ${auth.id} (label ${label})`, res);
    if (!res.ok) return;
    captureId = res.body.id;
    status = res.body.status;
  }

  if (captureId) entry.captureId = captureId;
  saveState(state);
  console.log(`  capture id: ${captureId ?? "(absent)"} (status ${status ?? "?"})`);
});
