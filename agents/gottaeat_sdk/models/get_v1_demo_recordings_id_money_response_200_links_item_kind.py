from enum import StrEnum


class GetV1DemoRecordingsIdMoneyResponse200LinksItemKind(StrEnum):
    AUTHORIZATION = "authorization"
    CAPTURE = "capture"
    ORDER = "order"

    def __str__(self) -> str:
        return str(self.value)
