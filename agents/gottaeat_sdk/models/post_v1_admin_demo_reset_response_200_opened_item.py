from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset


T = TypeVar("T", bound="PostV1AdminDemoResetResponse200OpenedItem")


@_attrs_define
class PostV1AdminDemoResetResponse200OpenedItem:
    """
    Attributes:
        id (str):
        title (str):
    """

    id: str
    title: str

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        title = self.title

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "title": title,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        title = d.pop("title")

        post_v1_admin_demo_reset_response_200_opened_item = cls(
            id=id,
            title=title,
        )

        return post_v1_admin_demo_reset_response_200_opened_item
