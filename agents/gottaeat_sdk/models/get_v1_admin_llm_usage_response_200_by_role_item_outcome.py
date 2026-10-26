from enum import StrEnum


class GetV1AdminLlmUsageResponse200ByRoleItemOutcome(StrEnum):
    ERROR = "error"
    INVALID_OUTPUT = "invalid_output"
    OK = "ok"
    OVER_BUDGET = "over_budget"
    TIMEOUT = "timeout"

    def __str__(self) -> str:
        return str(self.value)
