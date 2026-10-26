from enum import StrEnum


class GetV1AgentsIdSpendRequestsResponse200SpendRequestsItemDecisionsItemVerdict(StrEnum):
    ALLOW = "allow"
    ASK = "ask"
    DENY = "deny"

    def __str__(self) -> str:
        return str(self.value)
