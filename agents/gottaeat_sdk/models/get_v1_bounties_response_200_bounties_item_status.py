from enum import StrEnum


class GetV1BountiesResponse200BountiesItemStatus(StrEnum):
    CANCELLED = "cancelled"
    DRAFT = "draft"
    JUDGING = "judging"
    OPEN = "open"
    SETTLED = "settled"
    VOIDED = "voided"

    def __str__(self) -> str:
        return str(self.value)
