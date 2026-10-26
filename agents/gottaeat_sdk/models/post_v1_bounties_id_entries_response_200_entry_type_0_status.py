from enum import StrEnum


class PostV1BountiesIdEntriesResponse200EntryType0Status(StrEnum):
    ACTIVE = "active"
    PENDING_STAKE = "pending_stake"
    SUBMITTED = "submitted"
    WITHDRAWN = "withdrawn"

    def __str__(self) -> str:
        return str(self.value)
