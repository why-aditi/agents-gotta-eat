// Step 5: void the current authorization. Usage: pnpm void --label A
import { loadState, main, paypal, report, requireArg, requireLabel, saveState } from "./lib";

main(async () => {
  const label = requireArg("label");
  const state = loadState();
  const entry = requireLabel(state, label);
  const auth = entry.authorization;
  if (!auth) throw new Error(`Label ${label} has no authorization to void.`);

  const res = await paypal<{ status?: string } | null>(
    "POST",
    `/v2/payments/authorizations/${auth.id}/void`,
    undefined,
    `void-${label}`,
  );
  report(`void authorization ${auth.id} (label ${label})`, res);
  if (!res.ok) return;
  entry.voided = true;
  saveState(state);
  console.log(`  status: ${res.body?.status ?? "(no body)"}`);
});
