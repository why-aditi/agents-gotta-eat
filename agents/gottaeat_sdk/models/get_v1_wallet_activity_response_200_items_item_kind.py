from enum import StrEnum


class GetV1WalletActivityResponse200ItemsItemKind(StrEnum):
    CREDIT = "credit"
    EARNING = "earning"
    FEE = "fee"
    HOLD = "hold"
    OTHER = "other"
    REFUND = "refund"
    RELEASE = "release"
    SPEND = "spend"
    TOPUP = "topup"
    WITHDRAWAL = "withdrawal"

    def __str__(self) -> str:
        return str(self.value)
