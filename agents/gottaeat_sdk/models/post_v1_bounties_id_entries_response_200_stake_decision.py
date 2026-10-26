from enum import StrEnum


class PostV1BountiesIdEntriesResponse200StakeDecision(StrEnum):
    ALLOW = "allow"
    DENY = "deny"
    PENDING_APPROVAL = "pending_approval"

    def __str__(self) -> str:
        return str(self.value)
