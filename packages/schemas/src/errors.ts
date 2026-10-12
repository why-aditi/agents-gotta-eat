import { z } from "zod";

// Every error response uses this envelope: { error: { code, message, detail? } }.
export const ErrorCode = z.enum([
  "validation_error",
  "idempotency_key_required",
  "unauthorized",
  "forbidden",
  "not_found",
  "idempotency_in_progress",
  "idempotency_key_reuse",
  "insufficient_funds",
  "hold_not_open",
  "invalid_amount",
  "approval_expired",
  "already_decided",
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
