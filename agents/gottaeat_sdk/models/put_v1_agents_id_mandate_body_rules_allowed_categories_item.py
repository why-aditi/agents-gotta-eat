from enum import StrEnum


class PutV1AgentsIdMandateBodyRulesAllowedCategoriesItem(StrEnum):
    STAKE = "stake"
    SUBCONTRACT = "subcontract"
    TOOL = "tool"

    def __str__(self) -> str:
        return str(self.value)
