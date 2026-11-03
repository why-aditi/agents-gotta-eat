from enum import StrEnum


class GetV1BountiesType(StrEnum):
    CREATIVE_WRITING = "creative_writing"
    EXTRACT_DATA = "extract_data"

    def __str__(self) -> str:
        return str(self.value)
