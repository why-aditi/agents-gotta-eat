from enum import StrEnum


class GetV1AdminLlmUsageResponse200ByRoleItemRole(StrEnum):
    INTENT_CHECK = "intent_check"
    JUDGE = "judge"
    MANDATE_COMPILE = "mandate_compile"
    TREASURER = "treasurer"

    def __str__(self) -> str:
        return str(self.value)
