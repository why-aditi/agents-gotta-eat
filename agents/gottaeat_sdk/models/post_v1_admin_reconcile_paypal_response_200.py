from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
    from ..models.post_v1_admin_reconcile_paypal_response_200_counts import PostV1AdminReconcilePaypalResponse200Counts
    from ..models.post_v1_admin_reconcile_paypal_response_200_lines_item import (
        PostV1AdminReconcilePaypalResponse200LinesItem,
    )
    from ..models.post_v1_admin_reconcile_paypal_response_200_window import PostV1AdminReconcilePaypalResponse200Window


T = TypeVar("T", bound="PostV1AdminReconcilePaypalResponse200")


@_attrs_define
class PostV1AdminReconcilePaypalResponse200:
    """
    Attributes:
        ok (bool):
        checked_at (datetime.datetime):
        cached (bool):
        window (PostV1AdminReconcilePaypalResponse200Window):
        counts (PostV1AdminReconcilePaypalResponse200Counts):
        lines (list[PostV1AdminReconcilePaypalResponse200LinesItem]):
    """

    ok: bool
    checked_at: datetime.datetime
    cached: bool
    window: PostV1AdminReconcilePaypalResponse200Window
    counts: PostV1AdminReconcilePaypalResponse200Counts
    lines: list[PostV1AdminReconcilePaypalResponse200LinesItem]

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_v1_admin_reconcile_paypal_response_200_counts import (
            PostV1AdminReconcilePaypalResponse200Counts,
        )  # noqa: PLC0415
        from ..models.post_v1_admin_reconcile_paypal_response_200_lines_item import (
            PostV1AdminReconcilePaypalResponse200LinesItem,
        )  # noqa: PLC0415
        from ..models.post_v1_admin_reconcile_paypal_response_200_window import (
            PostV1AdminReconcilePaypalResponse200Window,
        )  # noqa: PLC0415

        ok = self.ok

        checked_at = self.checked_at.isoformat()

        cached = self.cached

        window = self.window.to_dict()

        counts = self.counts.to_dict()

        lines = []
        for lines_item_data in self.lines:
            lines_item = lines_item_data.to_dict()
            lines.append(lines_item)

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "ok": ok,
                "checkedAt": checked_at,
                "cached": cached,
                "window": window,
                "counts": counts,
                "lines": lines,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_v1_admin_reconcile_paypal_response_200_counts import (
            PostV1AdminReconcilePaypalResponse200Counts,
        )  # noqa: PLC0415
        from ..models.post_v1_admin_reconcile_paypal_response_200_lines_item import (
            PostV1AdminReconcilePaypalResponse200LinesItem,
        )  # noqa: PLC0415
        from ..models.post_v1_admin_reconcile_paypal_response_200_window import (
            PostV1AdminReconcilePaypalResponse200Window,
        )  # noqa: PLC0415

        d = dict(src_dict)
        ok = d.pop("ok")

        checked_at = datetime.datetime.fromisoformat(d.pop("checkedAt"))

        cached = d.pop("cached")

        window = PostV1AdminReconcilePaypalResponse200Window.from_dict(d.pop("window"))

        counts = PostV1AdminReconcilePaypalResponse200Counts.from_dict(d.pop("counts"))

        lines = []
        _lines = d.pop("lines")
        for lines_item_data in _lines:
            lines_item = PostV1AdminReconcilePaypalResponse200LinesItem.from_dict(lines_item_data)

            lines.append(lines_item)

        post_v1_admin_reconcile_paypal_response_200 = cls(
            ok=ok,
            checked_at=checked_at,
            cached=cached,
            window=window,
            counts=counts,
            lines=lines,
        )

        return post_v1_admin_reconcile_paypal_response_200
