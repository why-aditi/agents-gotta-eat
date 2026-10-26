from enum import StrEnum


class PostV1ApprovalsSpendRequestIdResponse200DecisionsItemGate(StrEnum):
    HARD_RULES = "hard_rules"
    INTENT = "intent"
    OWNER = "owner"

    def __str__(self) -> str:
        return str(self.value)
