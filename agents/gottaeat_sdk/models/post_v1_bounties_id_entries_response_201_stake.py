from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.post_v1_bounties_id_entries_response_201_stake_decision import (
    PostV1BountiesIdEntriesResponse201StakeDecision,
)
from typing import cast


T = TypeVar("T", bound="PostV1BountiesIdEntriesResponse201Stake")


@_attrs_define
class PostV1BountiesIdEntriesResponse201Stake:
    """
    Attributes:
        spend_request_id (str):
        decision (PostV1BountiesIdEntriesResponse201StakeDecision):
        reasons (list[str]):
    """

    spend_request_id: str
    decision: PostV1BountiesIdEntriesResponse201StakeDecision
    reasons: list[str]

    def to_dict(self) -> dict[str, Any]:
        spend_request_id = self.spend_request_id

        decision = self.decision.value

        reasons = self.reasons

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "spendRequestId": spend_request_id,
                "decision": decision,
                "reasons": reasons,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        spend_request_id = d.pop("spendRequestId")

        decision = PostV1BountiesIdEntriesResponse201StakeDecision(d.pop("decision"))

        reasons = cast(list[str], d.pop("reasons"))

        post_v1_bounties_id_entries_response_201_stake = cls(
            spend_request_id=spend_request_id,
            decision=decision,
            reasons=reasons,
        )

        return post_v1_bounties_id_entries_response_201_stake
