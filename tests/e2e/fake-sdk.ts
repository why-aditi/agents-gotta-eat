// Stands in for the PayPal JS SDK v6 in the browser: the page's script request is answered with a tiny `window.paypal`
// whose session plays the buyer ("approve" or "cancel") once the page hands it the order id. Mirrors
// apps/web/test/fake-paypal.ts, but as a real script the app loads from its normal SDK URL.
import type { Page } from "@playwright/test";

export async function installFakePayPalSdk(page: Page, { mode }: { mode: "approve" | "cancel" }) {
  const script = `
    window.paypal = {
      createInstance: async function () {
        return {
          findEligibleMethods: async function () { return { isEligible: function () { return true; } }; },
          createPayPalOneTimePaymentSession: async function (cb) {
            return {
              start: async function (opts, orderPromise) {
                try {
                  var res = await orderPromise;
                  if (${JSON.stringify(mode)} === "approve") await cb.onApprove({ orderId: res.orderId });
                  else cb.onCancel({ orderId: res.orderId });
                } catch (err) { cb.onError(err); }
              },
            };
          },
        };
      },
    };`;
  await page.route("**/web-sdk/v6/core*", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: script }),
  );
}
