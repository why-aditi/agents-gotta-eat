from enum import StrEnum


class PostV1AdminDisputesIdResolveBodyOutcome(StrEnum):
    OVERTURN = "overturn"
    UPHOLD = "uphold"

    def __str__(self) -> str:
        return str(self.value)
