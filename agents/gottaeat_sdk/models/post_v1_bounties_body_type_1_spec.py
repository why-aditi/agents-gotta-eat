from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset


T = TypeVar("T", bound="PostV1BountiesBodyType1Spec")


@_attrs_define
class PostV1BountiesBodyType1Spec:
    """
    Attributes:
        brief (str):
        rubric (str):
    """

    brief: str
    rubric: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        brief = self.brief

        rubric = self.rubric

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "brief": brief,
                "rubric": rubric,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        brief = d.pop("brief")

        rubric = d.pop("rubric")

        post_v1_bounties_body_type_1_spec = cls(
            brief=brief,
            rubric=rubric,
        )

        post_v1_bounties_body_type_1_spec.additional_properties = d
        return post_v1_bounties_body_type_1_spec

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
