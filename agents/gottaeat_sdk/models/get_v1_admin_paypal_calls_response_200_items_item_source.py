from enum import StrEnum


class GetV1AdminPaypalCallsResponse200ItemsItemSource(StrEnum):
    CLIENT = "client"
    TOOLKIT = "toolkit"

    def __str__(self) -> str:
        return str(self.value)
