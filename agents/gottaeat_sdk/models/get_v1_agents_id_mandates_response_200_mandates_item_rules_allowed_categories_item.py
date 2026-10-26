from enum import StrEnum


class GetV1AgentsIdMandatesResponse200MandatesItemRulesAllowedCategoriesItem(StrEnum):
    STAKE = "stake"
    SUBCONTRACT = "subcontract"
    TOOL = "tool"

    def __str__(self) -> str:
        return str(self.value)
