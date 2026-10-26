from enum import StrEnum


class GetV1BountiesIdResponse200Status(StrEnum):
    CANCELLED = "cancelled"
    DRAFT = "draft"
    JUDGING = "judging"
    OPEN = "open"
    SETTLED = "settled"
    VOIDED = "voided"

    def __str__(self) -> str:
        return str(self.value)
