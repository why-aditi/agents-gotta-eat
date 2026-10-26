from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
    from ..models.get_v1_admin_reconcile_response_200_checks_item import GetV1AdminReconcileResponse200ChecksItem


T = TypeVar("T", bound="GetV1AdminReconcileResponse200")


@_attrs_define
class GetV1AdminReconcileResponse200:
    """
    Attributes:
        ok (bool):
        checks (list[GetV1AdminReconcileResponse200ChecksItem]):
        checked_at (datetime.datetime):
    """

    ok: bool
    checks: list[GetV1AdminReconcileResponse200ChecksItem]
    checked_at: datetime.datetime

    def to_dict(self) -> dict[str, Any]:
        from ..models.get_v1_admin_reconcile_response_200_checks_item import GetV1AdminReconcileResponse200ChecksItem  # noqa: PLC0415

        ok = self.ok

        checks = []
        for checks_item_data in self.checks:
            checks_item = checks_item_data.to_dict()
            checks.append(checks_item)

        checked_at = self.checked_at.isoformat()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "ok": ok,
                "checks": checks,
                "checkedAt": checked_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_v1_admin_reconcile_response_200_checks_item import GetV1AdminReconcileResponse200ChecksItem  # noqa: PLC0415

        d = dict(src_dict)
        ok = d.pop("ok")

        checks = []
        _checks = d.pop("checks")
        for checks_item_data in _checks:
            checks_item = GetV1AdminReconcileResponse200ChecksItem.from_dict(checks_item_data)

            checks.append(checks_item)

        checked_at = datetime.datetime.fromisoformat(d.pop("checkedAt"))

        get_v1_admin_reconcile_response_200 = cls(
            ok=ok,
            checks=checks,
            checked_at=checked_at,
        )

        return get_v1_admin_reconcile_response_200
