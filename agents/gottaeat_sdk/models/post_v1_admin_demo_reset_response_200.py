from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.post_v1_admin_demo_reset_response_200_opened_item import PostV1AdminDemoResetResponse200OpenedItem


T = TypeVar("T", bound="PostV1AdminDemoResetResponse200")


@_attrs_define
class PostV1AdminDemoResetResponse200:
    """
    Attributes:
        opened (list[PostV1AdminDemoResetResponse200OpenedItem]):
        skipped (list[str]):
        credited_cents (int):
    """

    opened: list[PostV1AdminDemoResetResponse200OpenedItem]
    skipped: list[str]
    credited_cents: int

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_v1_admin_demo_reset_response_200_opened_item import PostV1AdminDemoResetResponse200OpenedItem  # noqa: PLC0415

        opened = []
        for opened_item_data in self.opened:
            opened_item = opened_item_data.to_dict()
            opened.append(opened_item)

        skipped = self.skipped

        credited_cents = self.credited_cents

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "opened": opened,
                "skipped": skipped,
                "creditedCents": credited_cents,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_v1_admin_demo_reset_response_200_opened_item import PostV1AdminDemoResetResponse200OpenedItem  # noqa: PLC0415

        d = dict(src_dict)
        opened = []
        _opened = d.pop("opened")
        for opened_item_data in _opened:
            opened_item = PostV1AdminDemoResetResponse200OpenedItem.from_dict(opened_item_data)

            opened.append(opened_item)

        skipped = cast(list[str], d.pop("skipped"))

        credited_cents = d.pop("creditedCents")

        post_v1_admin_demo_reset_response_200 = cls(
            opened=opened,
            skipped=skipped,
            credited_cents=credited_cents,
        )

        return post_v1_admin_demo_reset_response_200
