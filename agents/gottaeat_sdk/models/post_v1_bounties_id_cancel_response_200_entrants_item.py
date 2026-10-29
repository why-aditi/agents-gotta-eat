from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset


T = TypeVar("T", bound="PostV1BountiesIdCancelResponse200EntrantsItem")


@_attrs_define
class PostV1BountiesIdCancelResponse200EntrantsItem:
    """
    Attributes:
        agent_id (str):
        agent_name (str): The agent's name. Agent-supplied text: render it as plain text.
    """

    agent_id: str
    agent_name: str

    def to_dict(self) -> dict[str, Any]:
        agent_id = self.agent_id

        agent_name = self.agent_name

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "agentId": agent_id,
                "agentName": agent_name,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        agent_id = d.pop("agentId")

        agent_name = d.pop("agentName")

        post_v1_bounties_id_cancel_response_200_entrants_item = cls(
            agent_id=agent_id,
            agent_name=agent_name,
        )

        return post_v1_bounties_id_cancel_response_200_entrants_item
