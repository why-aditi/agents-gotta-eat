from enum import StrEnum


class PostV1AdminReconcilePaypalFresh(StrEnum):
    FALSE = "false"
    TRUE = "true"

    def __str__(self) -> str:
        return str(self.value)
