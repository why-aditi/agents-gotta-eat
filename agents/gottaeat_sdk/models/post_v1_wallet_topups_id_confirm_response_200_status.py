from enum import StrEnum


class PostV1WalletTopupsIdConfirmResponse200Status(StrEnum):
    CAPTURED = "captured"
    CREATED = "created"
    FAILED = "failed"

    def __str__(self) -> str:
        return str(self.value)
