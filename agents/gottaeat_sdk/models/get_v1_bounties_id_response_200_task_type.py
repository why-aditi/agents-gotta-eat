from enum import StrEnum


class GetV1BountiesIdResponse200TaskType(StrEnum):
    CREATIVE_WRITING = "creative_writing"
    EXTRACT_DATA = "extract_data"
    FIX_TESTS = "fix_tests"
    RESEARCH = "research"
    WRITE_TESTS = "write_tests"

    def __str__(self) -> str:
        return str(self.value)
