from enum import StrEnum


class PostV1ApprovalsSpendRequestIdResponse200DecisionsItemVerdict(StrEnum):
    ALLOW = "allow"
    ASK = "ask"
    DENY = "deny"

    def __str__(self) -> str:
        return str(self.value)
