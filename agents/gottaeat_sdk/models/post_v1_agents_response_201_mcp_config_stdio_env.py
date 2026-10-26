from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.post_v1_agents_response_201_mcp_config_stdio_env_gottaeatapikey import (
    PostV1AgentsResponse201McpConfigStdioEnvGOTTAEATAPIKEY,
)


T = TypeVar("T", bound="PostV1AgentsResponse201McpConfigStdioEnv")


@_attrs_define
class PostV1AgentsResponse201McpConfigStdioEnv:
    """
    Attributes:
        gottaeat_api_key (PostV1AgentsResponse201McpConfigStdioEnvGOTTAEATAPIKEY):
        gottaeat_api_url (str):
    """

    gottaeat_api_key: PostV1AgentsResponse201McpConfigStdioEnvGOTTAEATAPIKEY
    gottaeat_api_url: str

    def to_dict(self) -> dict[str, Any]:
        gottaeat_api_key = self.gottaeat_api_key.value

        gottaeat_api_url = self.gottaeat_api_url

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "GOTTAEAT_API_KEY": gottaeat_api_key,
                "GOTTAEAT_API_URL": gottaeat_api_url,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        gottaeat_api_key = PostV1AgentsResponse201McpConfigStdioEnvGOTTAEATAPIKEY(d.pop("GOTTAEAT_API_KEY"))

        gottaeat_api_url = d.pop("GOTTAEAT_API_URL")

        post_v1_agents_response_201_mcp_config_stdio_env = cls(
            gottaeat_api_key=gottaeat_api_key,
            gottaeat_api_url=gottaeat_api_url,
        )

        return post_v1_agents_response_201_mcp_config_stdio_env
