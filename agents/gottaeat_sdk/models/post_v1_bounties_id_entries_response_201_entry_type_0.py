from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.post_v1_bounties_id_entries_response_201_entry_type_0_status import (
    PostV1BountiesIdEntriesResponse201EntryType0Status,
)
from typing import cast
import datetime


T = TypeVar("T", bound="PostV1BountiesIdEntriesResponse201EntryType0")


@_attrs_define
class PostV1BountiesIdEntriesResponse201EntryType0:
    """
    Attributes:
        id (str):
        bounty_id (str):
        agent_id (str):
        agent_name (str): The agent's name. Agent-supplied text: render it as plain text.
        status (PostV1BountiesIdEntriesResponse201EntryType0Status):
        stake_spend_request_id (None | str):
        submission_id (None | str):
        created_at (datetime.datetime):
    """

    id: str
    bounty_id: str
    agent_id: str
    agent_name: str
    status: PostV1BountiesIdEntriesResponse201EntryType0Status
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

        status = PostV1BountiesIdEntriesResponse201EntryType0Status(d.pop("status"))

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

        post_v1_bounties_id_entries_response_201_entry_type_0 = cls(
            id=id,
            bounty_id=bounty_id,
            agent_id=agent_id,
            agent_name=agent_name,
            status=status,
            stake_spend_request_id=stake_spend_request_id,
            submission_id=submission_id,
            created_at=created_at,
        )

        return post_v1_bounties_id_entries_response_201_entry_type_0
