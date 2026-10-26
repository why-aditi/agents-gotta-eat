from enum import StrEnum


class GetV1AgentsIdSpendRequestsResponse401ErrorCode(StrEnum):
    ALREADY_DECIDED = "already_decided"
    ALREADY_SUBMITTED = "already_submitted"
    APPROVAL_EXPIRED = "approval_expired"
    BOUNTY_CLOSED = "bounty_closed"
    BOUNTY_HAS_ENTRIES = "bounty_has_entries"
    COMPILE_FAILED = "compile_failed"
    DEADLINE_PASSED = "deadline_passed"
    ENTRY_NOT_ACTIVE = "entry_not_active"
    ENTRY_NOT_SUBMITTED = "entry_not_submitted"
    FORBIDDEN = "forbidden"
    HOLD_NOT_OPEN = "hold_not_open"
    IDEMPOTENCY_IN_PROGRESS = "idempotency_in_progress"
    IDEMPOTENCY_KEY_REQUIRED = "idempotency_key_required"
    IDEMPOTENCY_KEY_REUSE = "idempotency_key_reuse"
    INSUFFICIENT_FUNDS = "insufficient_funds"
    INTERNAL = "internal"
    INVALID_AMOUNT = "invalid_amount"
    INVALID_TRANSITION = "invalid_transition"
    METHOD_NOT_ALLOWED = "method_not_allowed"
    NOT_FOUND = "not_found"
    NOT_JUDGING = "not_judging"
    NOT_POSTER_JUDGED = "not_poster_judged"
    SUBMISSION_TOO_LARGE = "submission_too_large"
    UNAUTHORIZED = "unauthorized"
    VALIDATION_ERROR = "validation_error"

    def __str__(self) -> str:
        return str(self.value)
