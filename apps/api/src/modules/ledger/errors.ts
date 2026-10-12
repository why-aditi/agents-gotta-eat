export type LedgerErrorCode =
  "UNBALANCED" | "INSUFFICIENT_FUNDS" | "UNKNOWN_ACCOUNT" | "HOLD_NOT_OPEN" | "INVALID_AMOUNT";

export class LedgerError extends Error {
  readonly code: LedgerErrorCode;

  constructor(code: LedgerErrorCode, message: string) {
    super(message);
    this.name = "LedgerError";
    this.code = code;
  }
}
