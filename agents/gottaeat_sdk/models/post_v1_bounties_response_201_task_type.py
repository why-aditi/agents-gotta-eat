from enum import StrEnum


class PostV1BountiesResponse201TaskType(StrEnum):
    CREATIVE_WRITING = "creative_writing"
    EXTRACT_DATA = "extract_data"
    FIX_TESTS = "fix_tests"
    RESEARCH = "research"
    WRITE_TESTS = "write_tests"

    def __str__(self) -> str:
        return str(self.value)
