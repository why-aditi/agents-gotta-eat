from enum import StrEnum


class PutV1AgentsIdMandateResponse201RulesAllowedCategoriesItem(StrEnum):
    STAKE = "stake"
    SUBCONTRACT = "subcontract"
    TOOL = "tool"

    def __str__(self) -> str:
        return str(self.value)
