from enum import StrEnum


class GetV1BountiesIdResultsResponse200EntriesItemStakeOutcomeType0(StrEnum):
    FORFEITED = "forfeited"
    REFUNDED = "refunded"

    def __str__(self) -> str:
        return str(self.value)
