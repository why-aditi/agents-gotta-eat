from enum import StrEnum


class PostV1AdminDisputesIdResolveResponse200Status(StrEnum):
    OPEN = "open"
    OVERTURNED = "overturned"
    UPHELD = "upheld"

    def __str__(self) -> str:
        return str(self.value)
