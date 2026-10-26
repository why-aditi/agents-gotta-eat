from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.post_v1_bounties_id_pick_response_200_entries_item_stake_outcome_type_0 import (
    PostV1BountiesIdPickResponse200EntriesItemStakeOutcomeType0,
)
from ..models.post_v1_bounties_id_pick_response_200_entries_item_status import (
    PostV1BountiesIdPickResponse200EntriesItemStatus,
)
from typing import cast


T = TypeVar("T", bound="PostV1BountiesIdPickResponse200EntriesItem")


@_attrs_define
class PostV1BountiesIdPickResponse200EntriesItem:
    """
    Attributes:
        entry_id (str):
        agent_id (str):
        status (PostV1BountiesIdPickResponse200EntriesItemStatus):
        score (int | None):
        passed (bool):
        stake_outcome (None | PostV1BountiesIdPickResponse200EntriesItemStakeOutcomeType0):
    """

    entry_id: str
    agent_id: str
    status: PostV1BountiesIdPickResponse200EntriesItemStatus
    score: int | None
    passed: bool
    stake_outcome: None | PostV1BountiesIdPickResponse200EntriesItemStakeOutcomeType0

    def to_dict(self) -> dict[str, Any]:
        entry_id = self.entry_id

        agent_id = self.agent_id

        status = self.status.value

        score: int | None
        score = self.score

        passed = self.passed

        stake_outcome: None | str
        if isinstance(self.stake_outcome, PostV1BountiesIdPickResponse200EntriesItemStakeOutcomeType0):
            stake_outcome = self.stake_outcome.value
        else:
            stake_outcome = self.stake_outcome

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "entryId": entry_id,
                "agentId": agent_id,
                "status": status,
                "score": score,
                "passed": passed,
                "stakeOutcome": stake_outcome,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        entry_id = d.pop("entryId")

        agent_id = d.pop("agentId")

        status = PostV1BountiesIdPickResponse200EntriesItemStatus(d.pop("status"))

        def _parse_score(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        score = _parse_score(d.pop("score"))

        passed = d.pop("passed")

        def _parse_stake_outcome(data: object) -> None | PostV1BountiesIdPickResponse200EntriesItemStakeOutcomeType0:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                stake_outcome_type_0 = PostV1BountiesIdPickResponse200EntriesItemStakeOutcomeType0(data)

                return stake_outcome_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | PostV1BountiesIdPickResponse200EntriesItemStakeOutcomeType0, data)

        stake_outcome = _parse_stake_outcome(d.pop("stakeOutcome"))

        post_v1_bounties_id_pick_response_200_entries_item = cls(
            entry_id=entry_id,
            agent_id=agent_id,
            status=status,
            score=score,
            passed=passed,
            stake_outcome=stake_outcome,
        )

        return post_v1_bounties_id_pick_response_200_entries_item
