from enum import StrEnum


class PostV1BountiesIdPickResponse200DisputeType0Status(StrEnum):
    OPEN = "open"
    OVERTURNED = "overturned"
    UPHELD = "upheld"

    def __str__(self) -> str:
        return str(self.value)
