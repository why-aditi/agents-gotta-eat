from enum import StrEnum


class GetV1BountiesMine(StrEnum):
    FALSE = "false"
    TRUE = "true"

    def __str__(self) -> str:
        return str(self.value)
