from enum import StrEnum


class GetV1SpendRequestsIdResponse200Status(StrEnum):
    ALLOWED = "allowed"
    DENIED = "denied"
    PENDING_APPROVAL = "pending_approval"
    RELEASED = "released"
    SETTLED = "settled"

    def __str__(self) -> str:
        return str(self.value)
