// Every error leaves the api as { error: { code, message, detail? } }.
import type { ErrorBody, ErrorCode } from "@gottaeat/schemas";
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { LedgerError, type LedgerErrorCode } from "../modules/ledger";

export const ERROR_STATUS: Record<ErrorCode, number> = {
  validation_error: 400,
  idempotency_key_required: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  idempotency_in_progress: 409,
  idempotency_key_reuse: 422,
  insufficient_funds: 409,
  hold_not_open: 409,
  invalid_amount: 400,
  internal: 500,
};

const DEFAULT_MESSAGE: Record<ErrorCode, string> = {
  validation_error: "Request validation failed",
  idempotency_key_required: "Idempotency-Key header must be 1-255 printable ASCII characters",
  unauthorized: "Missing or invalid credentials",
  forbidden: "Not allowed for this caller",
  not_found: "Not found",
  idempotency_in_progress: "A request with this Idempotency-Key is still in progress",
  idempotency_key_reuse: "This Idempotency-Key was used for a different request",
  insufficient_funds: "Insufficient funds",
  hold_not_open: "Hold is not open",
  invalid_amount: "Invalid amount",
  internal: "Internal server error",
};

// Throw this from handlers and hooks. The status comes from the code.
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly detail?: Record<string, unknown>;

  constructor(code: ErrorCode, message?: string, detail?: Record<string, unknown>, status?: number) {
    super(message ?? DEFAULT_MESSAGE[code]);
    this.name = "ApiError";
    this.code = code;
    this.status = status ?? ERROR_STATUS[code];
    this.detail = detail;
  }
}

// Ledger codes that callers can cause. UNBALANCED and UNKNOWN_ACCOUNT are our bugs, so they stay internal.
const LEDGER_CODES: Partial<Record<LedgerErrorCode, ErrorCode>> = {
  INSUFFICIENT_FUNDS: "insufficient_funds",
  HOLD_NOT_OPEN: "hold_not_open",
  INVALID_AMOUNT: "invalid_amount",
};

export interface ValidationIssue {
  in?: string;
  path: string;
  code: string;
  message: string;
}

function issuesFromZod(err: ZodError): ValidationIssue[] {
  return err.issues.map((i) => ({ path: `/${i.path.map(String).join("/")}`, code: i.code, message: i.message }));
}

function isFastifyError(err: unknown): err is FastifyError {
  return err instanceof Error && typeof (err as FastifyError).code === "string";
}

// Maps any thrown value to a public error. Only ApiError, validation, ledger and fastify client errors keep a message.
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof ZodError) return new ApiError("validation_error", undefined, { issues: issuesFromZod(err) });
  if (err instanceof LedgerError) {
    const code = LEDGER_CODES[err.code];
    return code ? new ApiError(code, err.message) : new ApiError("internal");
  }
  // Schema validation from the zod type provider (or any fastify validator) on body, params, query or headers.
  if (isFastifyError(err) && Array.isArray(err.validation)) {
    const issues: ValidationIssue[] = err.validation.map((v) => ({
      in: err.validationContext,
      path: v.instancePath || "/",
      code: v.keyword,
      message: v.message ?? "Invalid value",
    }));
    return new ApiError("validation_error", undefined, { issues });
  }
  // Fastify's own client errors (bad JSON, wrong content type, body too large) have safe messages.
  if (isFastifyError(err) && err.code.startsWith("FST_") && err.statusCode && err.statusCode < 500) {
    return new ApiError("validation_error", err.message, undefined, err.statusCode);
  }
  return new ApiError("internal");
}

export function errorBody(e: ApiError): ErrorBody {
  return { error: { code: e.code, message: e.message, ...(e.detail ? { detail: e.detail } : {}) } };
}

export function registerErrorHandlers(app: FastifyInstance) {
  app.setErrorHandler((err: unknown, req: FastifyRequest, reply: FastifyReply) => {
    const e = toApiError(err);
    if (e.status >= 500) req.log.error({ err }, "request failed");
    return reply
      .code(e.status)
      .type("application/json")
      .send(JSON.stringify(errorBody(e)));
  });

  app.setNotFoundHandler((req, reply) => {
    const e = new ApiError("not_found", `Route ${req.method} ${req.url.split("?")[0]} not found`);
    return reply
      .code(e.status)
      .type("application/json")
      .send(JSON.stringify(errorBody(e)));
  });
}
