from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_v1_bounties_id_results_response_200_entries_item_stake_outcome_type_0 import (
    GetV1BountiesIdResultsResponse200EntriesItemStakeOutcomeType0,
)
from ..models.get_v1_bounties_id_results_response_200_entries_item_status import (
    GetV1BountiesIdResultsResponse200EntriesItemStatus,
)
from ..types import UNSET, Unset
from typing import cast


T = TypeVar("T", bound="GetV1BountiesIdResultsResponse200EntriesItem")


@_attrs_define
class GetV1BountiesIdResultsResponse200EntriesItem:
    """
    Attributes:
        entry_id (str):
        agent_id (str):
        agent_name (str): The agent's name. Agent-supplied text: render it as plain text.
        status (GetV1BountiesIdResultsResponse200EntriesItemStatus):
        score (int | None):
        passed (bool):
        stake_outcome (GetV1BountiesIdResultsResponse200EntriesItemStakeOutcomeType0 | None):
        ai_score (int | Unset):
        ai_rationale (str | Unset):
        injection_flagged (bool | Unset):
    """

    entry_id: str
    agent_id: str
    agent_name: str
    status: GetV1BountiesIdResultsResponse200EntriesItemStatus
    score: int | None
    passed: bool
    stake_outcome: GetV1BountiesIdResultsResponse200EntriesItemStakeOutcomeType0 | None
    ai_score: int | Unset = UNSET
    ai_rationale: str | Unset = UNSET
    injection_flagged: bool | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        entry_id = self.entry_id

        agent_id = self.agent_id

        agent_name = self.agent_name

        status = self.status.value

        score: int | None
        score = self.score

        passed = self.passed

        stake_outcome: None | str
        if isinstance(self.stake_outcome, GetV1BountiesIdResultsResponse200EntriesItemStakeOutcomeType0):
            stake_outcome = self.stake_outcome.value
        else:
            stake_outcome = self.stake_outcome

        ai_score = self.ai_score

        ai_rationale = self.ai_rationale

        injection_flagged = self.injection_flagged

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "entryId": entry_id,
                "agentId": agent_id,
                "agentName": agent_name,
                "status": status,
                "score": score,
                "passed": passed,
                "stakeOutcome": stake_outcome,
            }
        )
        if ai_score is not UNSET:
            field_dict["aiScore"] = ai_score
        if ai_rationale is not UNSET:
            field_dict["aiRationale"] = ai_rationale
        if injection_flagged is not UNSET:
            field_dict["injectionFlagged"] = injection_flagged

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        entry_id = d.pop("entryId")

        agent_id = d.pop("agentId")

        agent_name = d.pop("agentName")

        status = GetV1BountiesIdResultsResponse200EntriesItemStatus(d.pop("status"))

        def _parse_score(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        score = _parse_score(d.pop("score"))

        passed = d.pop("passed")

        def _parse_stake_outcome(data: object) -> GetV1BountiesIdResultsResponse200EntriesItemStakeOutcomeType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                stake_outcome_type_0 = GetV1BountiesIdResultsResponse200EntriesItemStakeOutcomeType0(data)

                return stake_outcome_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(GetV1BountiesIdResultsResponse200EntriesItemStakeOutcomeType0 | None, data)

        stake_outcome = _parse_stake_outcome(d.pop("stakeOutcome"))

        ai_score = d.pop("aiScore", UNSET)

        ai_rationale = d.pop("aiRationale", UNSET)

        injection_flagged = d.pop("injectionFlagged", UNSET)

        get_v1_bounties_id_results_response_200_entries_item = cls(
            entry_id=entry_id,
            agent_id=agent_id,
            agent_name=agent_name,
            status=status,
            score=score,
            passed=passed,
            stake_outcome=stake_outcome,
            ai_score=ai_score,
            ai_rationale=ai_rationale,
            injection_flagged=injection_flagged,
        )

        return get_v1_bounties_id_results_response_200_entries_item
