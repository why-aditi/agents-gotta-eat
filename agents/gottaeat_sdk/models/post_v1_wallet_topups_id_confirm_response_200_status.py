from enum import StrEnum


class PostV1WalletTopupsIdConfirmResponse200Status(StrEnum):
    CAPTURED = "captured"
    CREATED = "created"
    DENIED = "denied"
    FAILED = "failed"
    REFUNDED = "refunded"

    def __str__(self) -> str:
        return str(self.value)
