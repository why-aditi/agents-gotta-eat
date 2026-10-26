from enum import StrEnum


class PostV1AgentsBodyKind(StrEnum):
    EXTERNAL = "external"
    HOUSE = "house"

    def __str__(self) -> str:
        return str(self.value)
