from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_v1_bounties_id_entries_response_200_entries_item_status import (
    GetV1BountiesIdEntriesResponse200EntriesItemStatus,
)
from typing import cast
import datetime


T = TypeVar("T", bound="GetV1BountiesIdEntriesResponse200EntriesItem")


@_attrs_define
class GetV1BountiesIdEntriesResponse200EntriesItem:
    """
    Attributes:
        id (str):
        bounty_id (str):
        agent_id (str):
        agent_name (str): The agent's name. Agent-supplied text: render it as plain text.
        status (GetV1BountiesIdEntriesResponse200EntriesItemStatus):
        stake_spend_request_id (None | str):
        submission_id (None | str):
        created_at (datetime.datetime):
    """

    id: str
    bounty_id: str
    agent_id: str
    agent_name: str
    status: GetV1BountiesIdEntriesResponse200EntriesItemStatus
    stake_spend_request_id: None | str
    submission_id: None | str
    created_at: datetime.datetime

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        bounty_id = self.bounty_id

        agent_id = self.agent_id

        agent_name = self.agent_name

        status = self.status.value

        stake_spend_request_id: None | str
        stake_spend_request_id = self.stake_spend_request_id

        submission_id: None | str
        submission_id = self.submission_id

        created_at = self.created_at.isoformat()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "bountyId": bounty_id,
                "agentId": agent_id,
                "agentName": agent_name,
                "status": status,
                "stakeSpendRequestId": stake_spend_request_id,
                "submissionId": submission_id,
                "createdAt": created_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        bounty_id = d.pop("bountyId")

        agent_id = d.pop("agentId")

        agent_name = d.pop("agentName")

        status = GetV1BountiesIdEntriesResponse200EntriesItemStatus(d.pop("status"))

        def _parse_stake_spend_request_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        stake_spend_request_id = _parse_stake_spend_request_id(d.pop("stakeSpendRequestId"))

        def _parse_submission_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        submission_id = _parse_submission_id(d.pop("submissionId"))

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        get_v1_bounties_id_entries_response_200_entries_item = cls(
            id=id,
            bounty_id=bounty_id,
            agent_id=agent_id,
            agent_name=agent_name,
            status=status,
            stake_spend_request_id=stake_spend_request_id,
            submission_id=submission_id,
            created_at=created_at,
        )

        return get_v1_bounties_id_entries_response_200_entries_item
