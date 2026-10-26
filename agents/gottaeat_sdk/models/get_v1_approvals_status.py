from enum import StrEnum


class GetV1ApprovalsStatus(StrEnum):
    PENDING = "pending"

    def __str__(self) -> str:
        return str(self.value)
