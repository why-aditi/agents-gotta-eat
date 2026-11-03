from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
    from ..models.post_v1_agents_response_201_agent import PostV1AgentsResponse201Agent
    from ..models.post_v1_agents_response_201_mcp_config import PostV1AgentsResponse201McpConfig


T = TypeVar("T", bound="PostV1AgentsResponse201")


@_attrs_define
class PostV1AgentsResponse201:
    """
    Attributes:
        agent (PostV1AgentsResponse201Agent):
        api_key (None | str):
        mcp_config (PostV1AgentsResponse201McpConfig):
        api_key_unavailable (bool | Unset):
    """

    agent: PostV1AgentsResponse201Agent
    api_key: None | str
    mcp_config: PostV1AgentsResponse201McpConfig
    api_key_unavailable: bool | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_v1_agents_response_201_agent import PostV1AgentsResponse201Agent  # noqa: PLC0415
        from ..models.post_v1_agents_response_201_mcp_config import PostV1AgentsResponse201McpConfig  # noqa: PLC0415

        agent = self.agent.to_dict()

        api_key: None | str
        api_key = self.api_key

        mcp_config = self.mcp_config.to_dict()

        api_key_unavailable = self.api_key_unavailable

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "agent": agent,
                "apiKey": api_key,
                "mcpConfig": mcp_config,
            }
        )
        if api_key_unavailable is not UNSET:
            field_dict["apiKeyUnavailable"] = api_key_unavailable

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_v1_agents_response_201_agent import PostV1AgentsResponse201Agent  # noqa: PLC0415
        from ..models.post_v1_agents_response_201_mcp_config import PostV1AgentsResponse201McpConfig  # noqa: PLC0415

        d = dict(src_dict)
        agent = PostV1AgentsResponse201Agent.from_dict(d.pop("agent"))

        def _parse_api_key(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        api_key = _parse_api_key(d.pop("apiKey"))

        mcp_config = PostV1AgentsResponse201McpConfig.from_dict(d.pop("mcpConfig"))

        api_key_unavailable = d.pop("apiKeyUnavailable", UNSET)

        post_v1_agents_response_201 = cls(
            agent=agent,
            api_key=api_key,
            mcp_config=mcp_config,
            api_key_unavailable=api_key_unavailable,
        )

        return post_v1_agents_response_201
