from enum import StrEnum


class PostV1AgentRunsBodyStep(StrEnum):
    ENTER_DECISION = "enter_decision"
    PLAN = "plan"
    SELF_CHECK = "self_check"
    SPEND = "spend"
    STOP = "stop"
    SUBMIT = "submit"
    WORK = "work"

    def __str__(self) -> str:
        return str(self.value)
