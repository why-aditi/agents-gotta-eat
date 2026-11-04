from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.post_v1_subcontracts_response_201_spend_decision import PostV1SubcontractsResponse201SpendDecision
from ..models.post_v1_subcontracts_response_201_spend_reasons_item import PostV1SubcontractsResponse201SpendReasonsItem
from ..models.post_v1_subcontracts_response_201_spend_status import PostV1SubcontractsResponse201SpendStatus
from ..types import UNSET, Unset
from typing import cast


T = TypeVar("T", bound="PostV1SubcontractsResponse201Spend")


@_attrs_define
class PostV1SubcontractsResponse201Spend:
    """
    Attributes:
        id (str):
        status (PostV1SubcontractsResponse201SpendStatus):
        decision (PostV1SubcontractsResponse201SpendDecision):
        reasons (list[PostV1SubcontractsResponse201SpendReasonsItem]):
        retry_after_seconds (int | Unset):
    """

    id: str
    status: PostV1SubcontractsResponse201SpendStatus
    decision: PostV1SubcontractsResponse201SpendDecision
    reasons: list[PostV1SubcontractsResponse201SpendReasonsItem]
    retry_after_seconds: int | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        status = self.status.value

        decision = self.decision.value

        reasons = []
        for reasons_item_data in self.reasons:
            reasons_item = reasons_item_data.value
            reasons.append(reasons_item)

        retry_after_seconds = self.retry_after_seconds

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "status": status,
                "decision": decision,
                "reasons": reasons,
            }
        )
        if retry_after_seconds is not UNSET:
            field_dict["retryAfterSeconds"] = retry_after_seconds

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        status = PostV1SubcontractsResponse201SpendStatus(d.pop("status"))

        decision = PostV1SubcontractsResponse201SpendDecision(d.pop("decision"))

        reasons = []
        _reasons = d.pop("reasons")
        for reasons_item_data in _reasons:
            reasons_item = PostV1SubcontractsResponse201SpendReasonsItem(reasons_item_data)

            reasons.append(reasons_item)

        retry_after_seconds = d.pop("retryAfterSeconds", UNSET)

        post_v1_subcontracts_response_201_spend = cls(
            id=id,
            status=status,
            decision=decision,
            reasons=reasons,
            retry_after_seconds=retry_after_seconds,
        )

        return post_v1_subcontracts_response_201_spend
