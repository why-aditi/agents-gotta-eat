from enum import StrEnum


class GetV1AgentsIdMandatesResponse200MandatesItemRulesScope(StrEnum):
    ANY = "any"
    CURRENT_BOUNTY_ONLY = "current_bounty_only"

    def __str__(self) -> str:
        return str(self.value)
