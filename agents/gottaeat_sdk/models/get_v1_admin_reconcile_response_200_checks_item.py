from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset


T = TypeVar("T", bound="GetV1AdminReconcileResponse200ChecksItem")


@_attrs_define
class GetV1AdminReconcileResponse200ChecksItem:
    """
    Attributes:
        name (str):
        ok (bool):
        detail (str):
    """

    name: str
    ok: bool
    detail: str

    def to_dict(self) -> dict[str, Any]:
        name = self.name

        ok = self.ok

        detail = self.detail

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "name": name,
                "ok": ok,
                "detail": detail,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        ok = d.pop("ok")

        detail = d.pop("detail")

        get_v1_admin_reconcile_response_200_checks_item = cls(
            name=name,
            ok=ok,
            detail=detail,
        )

        return get_v1_admin_reconcile_response_200_checks_item
