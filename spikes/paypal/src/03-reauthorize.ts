// Step 3: reauthorize the current authorization. Usage: pnpm reauthorize --label A
// Day 0 is expected to fail (honor period); day 4+ should return a new authorization id.
import { loadState, main, paypal, report, requireArg, requireLabel, saveState, toAuthRecord } from "./lib";
import type { PayPalAuthorization } from "./lib";

main(async () => {
  const label = requireArg("label");
  const state = loadState();
  const entry = requireLabel(state, label);
  const current = entry.authorization;
  if (!current) throw new Error(`Label ${label} has no authorization. Run: pnpm authorize --label ${label}`);

  const res = await paypal<PayPalAuthorization>(
    "POST",
    `/v2/payments/authorizations/${current.id}/reauthorize`,
    undefined,
    `reauthorize-${label}`,
  );
  report(`reauthorize ${current.id} (label ${label})`, res);
  if (!res.ok) return;

  const newId = res.body.id;
  if (!newId) {
    console.log("  success status but no id in response; see the log file");
    return;
  }
  console.log(
    `  new authorization id: ${newId} (${newId === current.id ? "SAME as before" : "different from " + current.id})`,
  );
  console.log(`  status: ${res.body.status ?? "?"}, expiration_time: ${res.body.expiration_time ?? "(absent)"}`);
  entry.authorizationHistory.push({ ...current, replacedBy: newId });
  entry.authorization = toAuthRecord({ ...res.body, id: newId });
  saveState(state);
  console.log(`  stored ${newId} as current; old id kept in history. Next: pnpm capture --label ${label}`);
});
