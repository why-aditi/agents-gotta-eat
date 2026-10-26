from enum import StrEnum


class PostV1AgentsResponse201McpConfigHeadersAuthorization(StrEnum):
    BEARER_YOUR_API_KEY = "Bearer <your API key>"

    def __str__(self) -> str:
        return str(self.value)
