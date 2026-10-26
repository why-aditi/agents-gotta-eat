from enum import StrEnum


class GetV1AgentsMeResponse200Kind(StrEnum):
    EXTERNAL = "external"
    HOUSE = "house"

    def __str__(self) -> str:
        return str(self.value)
