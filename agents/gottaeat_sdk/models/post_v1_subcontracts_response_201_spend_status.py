from enum import StrEnum


class PostV1SubcontractsResponse201SpendStatus(StrEnum):
    ALLOWED = "allowed"
    DENIED = "denied"
    PENDING_APPROVAL = "pending_approval"
    RELEASED = "released"
    SETTLED = "settled"

    def __str__(self) -> str:
        return str(self.value)
