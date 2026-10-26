from enum import StrEnum


class GetV1AdminJournalsIdResponse200Kind(StrEnum):
    FEE = "fee"
    HIRE = "hire"
    PAYOUT = "payout"
    REFUND = "refund"
    RELEASE = "release"
    SETTLE = "settle"
    STAKE = "stake"
    TOPUP = "topup"
    WITHDRAWAL = "withdrawal"
    WITHDRAWAL_RETURN = "withdrawal_return"

    def __str__(self) -> str:
        return str(self.value)
