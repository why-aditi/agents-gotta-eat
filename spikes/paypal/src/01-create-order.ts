// Step 1: create an order. Usage: pnpm order --intent AUTHORIZE|CAPTURE --cents 5500 --label A
import {
  findLink,
  formatCents,
  loadState,
  main,
  paypal,
  parseCents,
  report,
  requireArg,
  saveState,
  type Link,
} from "./lib";

interface OrderResponse {
  id?: string;
  status?: string;
  links?: Link[];
}

main(async () => {
  const intent = requireArg("intent").toUpperCase();
  if (intent !== "AUTHORIZE" && intent !== "CAPTURE") throw new Error("--intent must be AUTHORIZE or CAPTURE");
  const cents = parseCents(requireArg("cents"));
  const label = requireArg("label");

  const res = await paypal<OrderResponse>(
    "POST",
    "/v2/checkout/orders",
    {
      intent,
      purchase_units: [
        {
          reference_id: `spike-${label}`,
          description: `gottaeat spike order ${label}`,
          amount: { currency_code: "USD", value: formatCents(cents) },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            user_action: "CONTINUE",
            shipping_preference: "NO_SHIPPING",
            return_url: "https://example.com/spike/return",
            cancel_url: "https://example.com/spike/cancel",
          },
        },
      },
    },
    `create-order-${label}`,
  );
  report(`create order ${label} (${intent}, ${formatCents(cents)} USD)`, res);
  if (!res.ok || !res.body.id) return;

  const approveUrl = findLink(res.body.links, "payer-action", "approve");
  const state = loadState();
  state.labels[label] = { orderId: res.body.id, intent, cents: cents.toString(), approveUrl, authorizationHistory: [] };
  saveState(state);

  console.log(`  order id: ${res.body.id} (status ${res.body.status ?? "?"})`);
  console.log(`  approve as the sandbox buyer: ${approveUrl ?? "(no approve link returned)"}`);
  console.log(`  then: pnpm ${intent === "AUTHORIZE" ? "authorize" : "capture"} --label ${label}`);
});
