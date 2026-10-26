// A stand-in for the PayPal JS SDK v6 (`window.paypal`), so button tests never touch the network. `start()` awaits
// the order promise the way the real SDK does, then plays the buyer: approve, cancel or fail.
export type FakePaypal = { buyer: "approve" | "cancel" | "error"; eligible: boolean; started: number };

// The button caches the SDK instance for the whole page, so the instance must read one shared state object.
const fake: FakePaypal = { buyer: "approve", eligible: true, started: 0 };

export function installFakePaypal(): FakePaypal {
  Object.assign(fake, { buyer: "approve", eligible: true, started: 0 });
  (window as unknown as { paypal: unknown }).paypal = {
    createInstance: async () => ({
      findEligibleMethods: async () => ({ isEligible: (method: string) => method === "paypal" && fake.eligible }),
      createPayPalOneTimePaymentSession: (callbacks: {
        onApprove: (data: { orderId: string }) => Promise<void>;
        onCancel: () => void;
        onError: (error: unknown) => void;
      }) => ({
        start: async (_options: unknown, order: Promise<{ orderId: string }>) => {
          fake.started += 1;
          const { orderId } = await order;
          if (fake.buyer === "approve") await callbacks.onApprove({ orderId });
          else if (fake.buyer === "cancel") callbacks.onCancel();
          else callbacks.onError(new Error("PayPal exploded"));
        },
      }),
    }),
  };
  return fake;
}
