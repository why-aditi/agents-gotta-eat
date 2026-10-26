from enum import StrEnum


class PostV1AgentsIdRotateKeyResponse200AgentKind(StrEnum):
    EXTERNAL = "external"
    HOUSE = "house"

    def __str__(self) -> str:
        return str(self.value)
