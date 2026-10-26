from enum import StrEnum


class PostV1BountiesBodyType0TaskType(StrEnum):
    EXTRACT_DATA = "extract_data"

    def __str__(self) -> str:
        return str(self.value)
