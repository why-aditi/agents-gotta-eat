from enum import StrEnum


class GetV1DemoStatusResponse200FeaturedType0Source(StrEnum):
    IMPORT = "import"
    LIVE = "live"

    def __str__(self) -> str:
        return str(self.value)
