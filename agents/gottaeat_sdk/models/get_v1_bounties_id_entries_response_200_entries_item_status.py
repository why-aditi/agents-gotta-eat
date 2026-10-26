from enum import StrEnum


class GetV1BountiesIdEntriesResponse200EntriesItemStatus(StrEnum):
    ACTIVE = "active"
    PENDING_STAKE = "pending_stake"
    SUBMITTED = "submitted"
    WITHDRAWN = "withdrawn"

    def __str__(self) -> str:
        return str(self.value)
