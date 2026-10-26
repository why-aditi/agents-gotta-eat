// A stubbed PayPal for escrow tests: a real client over a fake fetch that behaves like the sandbox endpoints
// the escrow path uses. `fail` makes a path suffix answer with a PayPal error instead.
import { configurePayPal } from "../src/modules/paypal";
import { type Call, json, makeClient } from "../src/modules/paypal/test-utils";

export function fakePayPal() {
  const fail = new Map<string, { status: number; issue: string }>();
  let orders = 0;
  const { client, calls } = makeClient((call: Call) => {
    for (const [suffix, f] of fail) {
      if (call.path.endsWith(suffix)) {
        return json(
          f.status,
          { name: "UNPROCESSABLE_ENTITY", message: "refused", details: [{ issue: f.issue }] },
          { "paypal-debug-id": "dbg1" },
        );
      }
    }
    if (call.path === "/v2/checkout/orders") {
      const sent = JSON.parse(call.body ?? "{}").purchase_units[0];
      orders += 1;
      return json(201, { id: `ORDER${orders}`, status: "CREATED", purchase_units: [sent] });
    }
    if (call.path.endsWith("/authorize")) {
      return json(201, {
        id: call.path.split("/")[4],
        status: "COMPLETED",
        purchase_units: [{ payments: { authorizations: [{ id: "AUTH1" }] } }],
      });
    }
    if (call.path.endsWith("/capture")) return json(201, { id: "CAP1", status: "COMPLETED" });
    if (call.path.endsWith("/reauthorize")) return json(201, { id: "AUTH2", status: "CREATED" });
    if (call.path.endsWith("/void")) return new Response(null, { status: 204 });
    return json(404, { name: "NOT_FOUND", message: "unexpected call" });
  });
  configurePayPal(client);
  const sent = (suffix: string) => calls.filter((c) => c.path.endsWith(suffix));
  return { calls, fail, sent, reset: () => configurePayPal(null) };
}
