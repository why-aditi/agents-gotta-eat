from enum import StrEnum


class GetV1AgentsIdSpendRequestsResponse200SpendRequestsItemCategory(StrEnum):
    STAKE = "stake"
    SUBCONTRACT = "subcontract"
    TOOL = "tool"

    def __str__(self) -> str:
        return str(self.value)
