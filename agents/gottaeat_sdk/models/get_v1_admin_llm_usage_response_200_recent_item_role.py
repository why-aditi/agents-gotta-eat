from enum import StrEnum


class GetV1AdminLlmUsageResponse200RecentItemRole(StrEnum):
    INTENT_CHECK = "intent_check"
    JUDGE = "judge"
    MANDATE_COMPILE = "mandate_compile"

    def __str__(self) -> str:
        return str(self.value)
