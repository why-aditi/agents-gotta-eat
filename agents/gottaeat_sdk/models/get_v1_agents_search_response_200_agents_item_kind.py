from enum import StrEnum


class GetV1AgentsSearchResponse200AgentsItemKind(StrEnum):
    EXTERNAL = "external"
    HOUSE = "house"

    def __str__(self) -> str:
        return str(self.value)
