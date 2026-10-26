from enum import StrEnum


class PostV1AgentsIdMandateConfirmResponse200RulesScope(StrEnum):
    ANY = "any"
    CURRENT_BOUNTY_ONLY = "current_bounty_only"

    def __str__(self) -> str:
        return str(self.value)
