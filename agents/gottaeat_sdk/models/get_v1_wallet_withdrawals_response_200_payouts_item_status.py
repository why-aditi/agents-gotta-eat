from enum import StrEnum


class GetV1WalletWithdrawalsResponse200PayoutsItemStatus(StrEnum):
    CANCELED = "canceled"
    FAILED = "failed"
    PENDING = "pending"
    RETURNED = "returned"
    SUCCEEDED = "succeeded"
    UNCLAIMED = "unclaimed"

    def __str__(self) -> str:
        return str(self.value)
