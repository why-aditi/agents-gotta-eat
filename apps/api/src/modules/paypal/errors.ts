// A non-2xx answer from PayPal (or a network failure, status 0). debugId is the paypal-debug-id header: quote it to PayPal support.
export class PayPalError extends Error {
  constructor(
    readonly status: number,
    // PayPal's error name, e.g. "UNPROCESSABLE_ENTITY". Not `name`, which stays "PayPalError".
    readonly errorName: string,
    readonly issue: string,
    readonly debugId: string | null,
    message: string,
  ) {
    super(message);
    this.name = "PayPalError";
  }
}

// Thrown when PayPal credentials are missing; routes map it to 503 paypal_not_configured.
export class PayPalNotConfigured extends Error {
  constructor() {
    super("PayPal is not configured (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_API_BASE)");
    this.name = "PayPalNotConfigured";
  }
}
