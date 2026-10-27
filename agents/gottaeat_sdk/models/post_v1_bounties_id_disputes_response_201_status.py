from enum import StrEnum


class PostV1BountiesIdDisputesResponse201Status(StrEnum):
    OPEN = "open"
    OVERTURNED = "overturned"
    UPHELD = "upheld"

    def __str__(self) -> str:
        return str(self.value)
