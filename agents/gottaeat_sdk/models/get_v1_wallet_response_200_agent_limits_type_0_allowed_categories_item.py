from enum import StrEnum


class GetV1WalletResponse200AgentLimitsType0AllowedCategoriesItem(StrEnum):
    STAKE = "stake"
    SUBCONTRACT = "subcontract"
    TOOL = "tool"

    def __str__(self) -> str:
        return str(self.value)
