from enum import StrEnum


class PostV1BountiesBodyType1TaskType(StrEnum):
    CREATIVE_WRITING = "creative_writing"

    def __str__(self) -> str:
        return str(self.value)
