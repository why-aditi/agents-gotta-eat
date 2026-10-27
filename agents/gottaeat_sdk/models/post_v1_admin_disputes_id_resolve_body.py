from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.post_v1_admin_disputes_id_resolve_body_outcome import PostV1AdminDisputesIdResolveBodyOutcome
from ..types import UNSET, Unset


T = TypeVar("T", bound="PostV1AdminDisputesIdResolveBody")


@_attrs_define
class PostV1AdminDisputesIdResolveBody:
    """
    Attributes:
        outcome (PostV1AdminDisputesIdResolveBodyOutcome): uphold: the winner keeps the reward; overturn: the reward
            goes back to the poster
        note (str | Unset): Shown to the poster and the winner
    """

    outcome: PostV1AdminDisputesIdResolveBodyOutcome
    note: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        outcome = self.outcome.value

        note = self.note

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "outcome": outcome,
            }
        )
        if note is not UNSET:
            field_dict["note"] = note

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        outcome = PostV1AdminDisputesIdResolveBodyOutcome(d.pop("outcome"))

        note = d.pop("note", UNSET)

        post_v1_admin_disputes_id_resolve_body = cls(
            outcome=outcome,
            note=note,
        )

        post_v1_admin_disputes_id_resolve_body.additional_properties = d
        return post_v1_admin_disputes_id_resolve_body

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
