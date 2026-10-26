from enum import StrEnum


class PostV1AgentsResponse201McpConfigStdioCommand(StrEnum):
    NPX = "npx"

    def __str__(self) -> str:
        return str(self.value)
