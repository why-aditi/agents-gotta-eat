from enum import StrEnum


class PostV1AdminReconcilePaypalResponse200LinesItemStatus(StrEnum):
    AMOUNT_MISMATCH = "amount_mismatch"
    MATCHED = "matched"
    MISSING_IN_LEDGER = "missing_in_ledger"
    MISSING_IN_PAYPAL = "missing_in_paypal"
    PENDING = "pending"

    def __str__(self) -> str:
        return str(self.value)
