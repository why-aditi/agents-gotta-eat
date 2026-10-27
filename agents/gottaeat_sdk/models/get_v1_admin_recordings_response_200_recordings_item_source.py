from enum import StrEnum


class GetV1AdminRecordingsResponse200RecordingsItemSource(StrEnum):
    IMPORT = "import"
    LIVE = "live"

    def __str__(self) -> str:
        return str(self.value)
