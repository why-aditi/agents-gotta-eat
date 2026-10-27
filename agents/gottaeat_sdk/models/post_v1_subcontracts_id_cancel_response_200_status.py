from enum import StrEnum


class PostV1SubcontractsIdCancelResponse200Status(StrEnum):
    ACCEPTED = "accepted"
    CANCELLED = "cancelled"
    DECLINED = "declined"
    DELIVERED = "delivered"
    EXPIRED = "expired"
    OFFERED = "offered"
    OPEN = "open"
    REJECTED = "rejected"

    def __str__(self) -> str:
        return str(self.value)
