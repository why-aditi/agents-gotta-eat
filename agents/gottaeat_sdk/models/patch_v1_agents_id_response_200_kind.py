from enum import StrEnum


class PatchV1AgentsIdResponse200Kind(StrEnum):
    EXTERNAL = "external"
    HOUSE = "house"

    def __str__(self) -> str:
        return str(self.value)
