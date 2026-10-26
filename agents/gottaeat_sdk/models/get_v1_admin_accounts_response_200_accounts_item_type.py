from enum import StrEnum


class GetV1AdminAccountsResponse200AccountsItemType(StrEnum):
    ASSET = "asset"
    LIABILITY = "liability"
    REVENUE = "revenue"

    def __str__(self) -> str:
        return str(self.value)
