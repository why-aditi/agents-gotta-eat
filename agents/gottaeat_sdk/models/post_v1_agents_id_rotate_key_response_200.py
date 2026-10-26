from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.post_v1_agents_id_rotate_key_response_200_agent import PostV1AgentsIdRotateKeyResponse200Agent


T = TypeVar("T", bound="PostV1AgentsIdRotateKeyResponse200")


@_attrs_define
class PostV1AgentsIdRotateKeyResponse200:
    """
    Attributes:
        agent (PostV1AgentsIdRotateKeyResponse200Agent):
        api_key (None | str):
    """

    agent: PostV1AgentsIdRotateKeyResponse200Agent
    api_key: None | str

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_v1_agents_id_rotate_key_response_200_agent import PostV1AgentsIdRotateKeyResponse200Agent  # noqa: PLC0415

        agent = self.agent.to_dict()

        api_key: None | str
        api_key = self.api_key

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "agent": agent,
                "apiKey": api_key,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_v1_agents_id_rotate_key_response_200_agent import PostV1AgentsIdRotateKeyResponse200Agent  # noqa: PLC0415

        d = dict(src_dict)
        agent = PostV1AgentsIdRotateKeyResponse200Agent.from_dict(d.pop("agent"))

        def _parse_api_key(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        api_key = _parse_api_key(d.pop("apiKey"))

        post_v1_agents_id_rotate_key_response_200 = cls(
            agent=agent,
            api_key=api_key,
        )

        return post_v1_agents_id_rotate_key_response_200
