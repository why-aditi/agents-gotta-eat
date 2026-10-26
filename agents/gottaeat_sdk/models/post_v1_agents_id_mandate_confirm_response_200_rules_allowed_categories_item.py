from enum import StrEnum


class PostV1AgentsIdMandateConfirmResponse200RulesAllowedCategoriesItem(StrEnum):
    STAKE = "stake"
    SUBCONTRACT = "subcontract"
    TOOL = "tool"

    def __str__(self) -> str:
        return str(self.value)
