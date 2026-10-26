from enum import StrEnum


class PostV1AdminRecordingsStopResponse200Source(StrEnum):
    IMPORT = "import"
    LIVE = "live"

    def __str__(self) -> str:
        return str(self.value)
