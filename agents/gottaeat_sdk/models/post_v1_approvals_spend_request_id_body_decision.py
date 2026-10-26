from enum import StrEnum


class PostV1ApprovalsSpendRequestIdBodyDecision(StrEnum):
    APPROVE = "approve"
    DENY = "deny"

    def __str__(self) -> str:
        return str(self.value)
