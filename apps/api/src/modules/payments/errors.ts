import { ApiError } from "../../http/errors";
import { PayPalError } from "../paypal";

// For `.catch(asApiError)` on PayPal calls: a PayPal rejection becomes 502 paypal_error carrying the debug id.
export function asApiError(err: unknown): never {
  if (err instanceof PayPalError) {
    throw new ApiError("paypal_error", `PayPal: ${err.issue || err.errorName}`, { debugId: err.debugId });
  }
  throw err;
}
