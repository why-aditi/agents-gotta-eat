from enum import StrEnum


class GetV1AdminDisputesStatus(StrEnum):
    OPEN = "open"
    OVERTURNED = "overturned"
    UPHELD = "upheld"

    def __str__(self) -> str:
        return str(self.value)
