from enum import StrEnum


class GetV1SpendRequestsIdResponse200DecisionsItemGate(StrEnum):
    HARD_RULES = "hard_rules"
    INTENT = "intent"
    OWNER = "owner"

    def __str__(self) -> str:
        return str(self.value)
