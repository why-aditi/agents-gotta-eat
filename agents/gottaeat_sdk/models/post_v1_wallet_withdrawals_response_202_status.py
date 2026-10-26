from enum import StrEnum


class PostV1WalletWithdrawalsResponse202Status(StrEnum):
    CANCELED = "canceled"
    FAILED = "failed"
    PENDING = "pending"
    RETURNED = "returned"
    SUCCEEDED = "succeeded"
    UNCLAIMED = "unclaimed"

    def __str__(self) -> str:
        return str(self.value)
