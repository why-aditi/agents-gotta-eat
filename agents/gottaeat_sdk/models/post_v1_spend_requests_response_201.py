from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.post_v1_spend_requests_response_201_decision import PostV1SpendRequestsResponse201Decision
from ..models.post_v1_spend_requests_response_201_reasons_item import PostV1SpendRequestsResponse201ReasonsItem
from ..models.post_v1_spend_requests_response_201_status import PostV1SpendRequestsResponse201Status
from typing import cast


T = TypeVar("T", bound="PostV1SpendRequestsResponse201")


@_attrs_define
class PostV1SpendRequestsResponse201:
    """
    Attributes:
        id (str):
        status (PostV1SpendRequestsResponse201Status):
        decision (PostV1SpendRequestsResponse201Decision):
        reasons (list[PostV1SpendRequestsResponse201ReasonsItem]):
    """

    id: str
    status: PostV1SpendRequestsResponse201Status
    decision: PostV1SpendRequestsResponse201Decision
    reasons: list[PostV1SpendRequestsResponse201ReasonsItem]

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        status = self.status.value

        decision = self.decision.value

        reasons = []
        for reasons_item_data in self.reasons:
            reasons_item = reasons_item_data.value
            reasons.append(reasons_item)

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "status": status,
                "decision": decision,
                "reasons": reasons,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        status = PostV1SpendRequestsResponse201Status(d.pop("status"))

        decision = PostV1SpendRequestsResponse201Decision(d.pop("decision"))

        reasons = []
        _reasons = d.pop("reasons")
        for reasons_item_data in _reasons:
            reasons_item = PostV1SpendRequestsResponse201ReasonsItem(reasons_item_data)

            reasons.append(reasons_item)

        post_v1_spend_requests_response_201 = cls(
            id=id,
            status=status,
            decision=decision,
            reasons=reasons,
        )

        return post_v1_spend_requests_response_201
