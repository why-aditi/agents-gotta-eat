import { z } from "zod";

// Every error response uses this envelope: { error: { code, message, detail? } }.
export const ErrorCode = z.enum([
  "validation_error",
  "idempotency_key_required",
  "unauthorized",
  "forbidden",
  "not_found",
  "method_not_allowed",
  "idempotency_in_progress",
  "idempotency_key_reuse",
  "insufficient_funds",
  "hold_not_open",
  "invalid_amount",
  "approval_expired",
  "already_decided",
  "bounty_has_entries",
  "already_submitted",
  "deadline_passed",
  "entry_not_active",
  "submission_too_large",
  "invalid_transition",
  "bounty_closed",
  "not_poster_judged",
  "not_judging",
  "entry_not_submitted",
  "paypal_not_configured",
  "paypal_error",
  "escrow_not_authorized",
  "below_minimum",
  "no_paypal_email",
  "internal",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ErrorBody = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    detail: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type ErrorBody = z.infer<typeof ErrorBody>;
