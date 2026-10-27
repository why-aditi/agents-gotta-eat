from enum import StrEnum


class GetV1BountiesIdResultsResponse200DisputeType0Status(StrEnum):
    OPEN = "open"
    OVERTURNED = "overturned"
    UPHELD = "upheld"

    def __str__(self) -> str:
        return str(self.value)
