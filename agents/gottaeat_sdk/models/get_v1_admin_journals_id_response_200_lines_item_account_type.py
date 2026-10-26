from enum import StrEnum


class GetV1AdminJournalsIdResponse200LinesItemAccountType(StrEnum):
    ASSET = "asset"
    LIABILITY = "liability"
    REVENUE = "revenue"

    def __str__(self) -> str:
        return str(self.value)
