from enum import StrEnum


class GetV1SubcontractsRole(StrEnum):
    HIRER = "hirer"
    WORKER = "worker"

    def __str__(self) -> str:
        return str(self.value)
