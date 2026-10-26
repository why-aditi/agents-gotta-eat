from enum import StrEnum


class PostV1BountiesIdPickResponse200EntriesItemStakeOutcomeType0(StrEnum):
    FORFEITED = "forfeited"
    REFUNDED = "refunded"

    def __str__(self) -> str:
        return str(self.value)
