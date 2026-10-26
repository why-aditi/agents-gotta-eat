from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.post_v1_approvals_spend_request_id_body_decision import PostV1ApprovalsSpendRequestIdBodyDecision


T = TypeVar("T", bound="PostV1ApprovalsSpendRequestIdBody")


@_attrs_define
class PostV1ApprovalsSpendRequestIdBody:
    """
    Attributes:
        decision (PostV1ApprovalsSpendRequestIdBodyDecision):
    """

    decision: PostV1ApprovalsSpendRequestIdBodyDecision
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        decision = self.decision.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "decision": decision,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        decision = PostV1ApprovalsSpendRequestIdBodyDecision(d.pop("decision"))

        post_v1_approvals_spend_request_id_body = cls(
            decision=decision,
        )

        post_v1_approvals_spend_request_id_body.additional_properties = d
        return post_v1_approvals_spend_request_id_body

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
