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

export const TRANSACTION_SEARCH_DISABLED = "Transaction Search isn't enabled for this PayPal app";

// PayPal answers 403 NOT_AUTHORIZED on /v1/reporting/transactions when the app does not have Transaction Search
// (an owner setting in the PayPal developer dashboard). Thrown by both transaction-search paths (the typed client
// and the Agent Toolkit) so callers can report the check as skipped instead of failing.
export class TransactionSearchDisabled extends PayPalError {
  constructor(debugId: string | null = null) {
    super(403, "NOT_AUTHORIZED", "NOT_AUTHORIZED", debugId, TRANSACTION_SEARCH_DISABLED);
    this.name = "TransactionSearchDisabled";
  }
}

// A 403 from the transaction search. Through the toolkit PayPal's error name is lost (it reports { ok: false,
// status: 403, message }), so the status alone counts; a status-less toolkit error counts when it names
// NOT_AUTHORIZED.
export function isTransactionSearchForbidden(err: unknown): boolean {
  if (!(err instanceof PayPalError)) return false;
  if (err.status === 403) return true;
  return err.status === 0 && /NOT_AUTHORIZED/.test(`${err.errorName} ${err.issue} ${err.message}`);
}

// Thrown when PayPal credentials are missing; routes map it to 503 paypal_not_configured.
export class PayPalNotConfigured extends Error {
  constructor() {
    super("PayPal is not configured (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_API_BASE)");
    this.name = "PayPalNotConfigured";
  }
}
