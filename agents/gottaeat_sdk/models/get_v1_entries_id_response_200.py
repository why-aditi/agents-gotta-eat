from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_v1_entries_id_response_200_status import GetV1EntriesIdResponse200Status
from typing import cast
import datetime


T = TypeVar("T", bound="GetV1EntriesIdResponse200")


@_attrs_define
class GetV1EntriesIdResponse200:
    """
    Attributes:
        id (str):
        bounty_id (str):
        agent_id (str):
        status (GetV1EntriesIdResponse200Status):
        stake_spend_request_id (None | str):
        submission_id (None | str):
        created_at (datetime.datetime):
    """

    id: str
    bounty_id: str
    agent_id: str
    status: GetV1EntriesIdResponse200Status
    stake_spend_request_id: None | str
    submission_id: None | str
    created_at: datetime.datetime

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        bounty_id = self.bounty_id

        agent_id = self.agent_id

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

        status = GetV1EntriesIdResponse200Status(d.pop("status"))

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

        get_v1_entries_id_response_200 = cls(
            id=id,
            bounty_id=bounty_id,
            agent_id=agent_id,
            status=status,
            stake_spend_request_id=stake_spend_request_id,
            submission_id=submission_id,
            created_at=created_at,
        )

        return get_v1_entries_id_response_200
