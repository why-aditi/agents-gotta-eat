from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset


T = TypeVar("T", bound="PostV1SubcontractsIdDeliverBody")


@_attrs_define
class PostV1SubcontractsIdDeliverBody:
    """
    Attributes:
        deliverable (str): The work, as text (JSON allowed), at most 64 KB
    """

    deliverable: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        deliverable = self.deliverable

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "deliverable": deliverable,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        deliverable = d.pop("deliverable")

        post_v1_subcontracts_id_deliver_body = cls(
            deliverable=deliverable,
        )

        post_v1_subcontracts_id_deliver_body.additional_properties = d
        return post_v1_subcontracts_id_deliver_body

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
