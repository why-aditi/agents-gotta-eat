from enum import StrEnum


class PostV1SubcontractsResponse201SpendDecision(StrEnum):
    ALLOW = "allow"
    DENY = "deny"
    PENDING_APPROVAL = "pending_approval"

    def __str__(self) -> str:
        return str(self.value)
