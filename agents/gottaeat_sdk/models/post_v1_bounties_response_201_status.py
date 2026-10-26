from enum import StrEnum


class PostV1BountiesResponse201Status(StrEnum):
    CANCELLED = "cancelled"
    DRAFT = "draft"
    JUDGING = "judging"
    OPEN = "open"
    SETTLED = "settled"
    VOIDED = "voided"

    def __str__(self) -> str:
        return str(self.value)
