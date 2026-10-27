from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset


T = TypeVar("T", bound="PostV1AdminReconcilePaypalResponse200Counts")


@_attrs_define
class PostV1AdminReconcilePaypalResponse200Counts:
    """
    Attributes:
        matched (int):
        missing_in_paypal (int):
        missing_in_ledger (int):
        amount_mismatch (int):
        pending (int):
        unrelated (int):
    """

    matched: int
    missing_in_paypal: int
    missing_in_ledger: int
    amount_mismatch: int
    pending: int
    unrelated: int

    def to_dict(self) -> dict[str, Any]:
        matched = self.matched

        missing_in_paypal = self.missing_in_paypal

        missing_in_ledger = self.missing_in_ledger

        amount_mismatch = self.amount_mismatch

        pending = self.pending

        unrelated = self.unrelated

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "matched": matched,
                "missing_in_paypal": missing_in_paypal,
                "missing_in_ledger": missing_in_ledger,
                "amount_mismatch": amount_mismatch,
                "pending": pending,
                "unrelated": unrelated,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        matched = d.pop("matched")

        missing_in_paypal = d.pop("missing_in_paypal")

        missing_in_ledger = d.pop("missing_in_ledger")

        amount_mismatch = d.pop("amount_mismatch")

        pending = d.pop("pending")

        unrelated = d.pop("unrelated")

        post_v1_admin_reconcile_paypal_response_200_counts = cls(
            matched=matched,
            missing_in_paypal=missing_in_paypal,
            missing_in_ledger=missing_in_ledger,
            amount_mismatch=amount_mismatch,
            pending=pending,
            unrelated=unrelated,
        )

        return post_v1_admin_reconcile_paypal_response_200_counts
