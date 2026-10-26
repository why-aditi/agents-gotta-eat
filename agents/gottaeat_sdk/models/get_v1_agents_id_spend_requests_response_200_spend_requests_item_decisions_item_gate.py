from enum import StrEnum


class GetV1AgentsIdSpendRequestsResponse200SpendRequestsItemDecisionsItemGate(StrEnum):
    HARD_RULES = "hard_rules"
    INTENT = "intent"
    OWNER = "owner"

    def __str__(self) -> str:
        return str(self.value)
