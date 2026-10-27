from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime


T = TypeVar("T", bound="PostV1AdminReconcilePaypalResponse200Window")


@_attrs_define
class PostV1AdminReconcilePaypalResponse200Window:
    """
    Attributes:
        from_ (datetime.datetime):
        to (datetime.datetime):
        days (int):
    """

    from_: datetime.datetime
    to: datetime.datetime
    days: int

    def to_dict(self) -> dict[str, Any]:
        from_ = self.from_.isoformat()

        to = self.to.isoformat()

        days = self.days

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "from": from_,
                "to": to,
                "days": days,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        from_ = datetime.datetime.fromisoformat(d.pop("from"))

        to = datetime.datetime.fromisoformat(d.pop("to"))

        days = d.pop("days")

        post_v1_admin_reconcile_paypal_response_200_window = cls(
            from_=from_,
            to=to,
            days=days,
        )

        return post_v1_admin_reconcile_paypal_response_200_window
