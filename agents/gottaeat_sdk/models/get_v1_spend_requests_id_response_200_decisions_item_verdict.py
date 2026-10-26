from enum import StrEnum


class GetV1SpendRequestsIdResponse200DecisionsItemVerdict(StrEnum):
    ALLOW = "allow"
    ASK = "ask"
    DENY = "deny"

    def __str__(self) -> str:
        return str(self.value)
