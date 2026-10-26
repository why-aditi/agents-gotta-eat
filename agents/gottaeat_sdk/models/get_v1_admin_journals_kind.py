from enum import StrEnum


class GetV1AdminJournalsKind(StrEnum):
    FEE = "fee"
    HIRE = "hire"
    PAYOUT = "payout"
    REFUND = "refund"
    RELEASE = "release"
    SETTLE = "settle"
    STAKE = "stake"
    TOPUP = "topup"

    def __str__(self) -> str:
        return str(self.value)
