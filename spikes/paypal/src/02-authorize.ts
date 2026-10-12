// Step 2: authorize an approved order. Usage: pnpm authorize --label A
import { loadState, main, paypal, report, requireArg, requireLabel, saveState, toAuthRecord } from "./lib";
import type { PayPalAuthorization } from "./lib";

interface AuthorizeOrderResponse {
  id?: string;
  status?: string;
  purchase_units?: { payments?: { authorizations?: PayPalAuthorization[] } }[];
}

main(async () => {
  const label = requireArg("label");
  const state = loadState();
  const entry = requireLabel(state, label);

  const res = await paypal<AuthorizeOrderResponse>(
    "POST",
    `/v2/checkout/orders/${entry.orderId}/authorize`,
    undefined,
    `authorize-${label}`,
  );
  report(`authorize order ${entry.orderId} (label ${label})`, res);
  if (!res.ok) return;

  const auth = res.body.purchase_units?.[0]?.payments?.authorizations?.[0];
  if (!auth?.id) {
    console.log("  no authorization in response; see the log file");
    process.exitCode = 1;
    return;
  }
  if (entry.authorization) entry.authorizationHistory.push({ ...entry.authorization, replacedBy: auth.id });
  entry.authorization = toAuthRecord({ ...auth, id: auth.id });
  saveState(state);

  console.log(`  authorization id: ${auth.id} (status ${auth.status ?? "?"})`);
  console.log(`  expiration_time: ${auth.expiration_time ?? "(absent)"}`);
  const honor = entry.authorization.honorFields;
  console.log(`  honor-period fields: ${honor ? JSON.stringify(honor) : "(none in response)"}`);
});
