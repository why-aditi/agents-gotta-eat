from enum import StrEnum


class PostV1SpendRequestsBodyCategory(StrEnum):
    SUBCONTRACT = "subcontract"
    TOOL = "tool"

    def __str__(self) -> str:
        return str(self.value)
