from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset


T = TypeVar("T", bound="PostV1AdminBountiesIdOpenBody")


@_attrs_define
class PostV1AdminBountiesIdOpenBody:
    def to_dict(self) -> dict[str, Any]:

        field_dict: dict[str, Any] = {}

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        post_v1_admin_bounties_id_open_body = cls()

        return post_v1_admin_bounties_id_open_body
