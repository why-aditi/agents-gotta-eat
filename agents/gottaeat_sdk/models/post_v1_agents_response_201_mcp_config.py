from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.post_v1_agents_response_201_mcp_config_headers import PostV1AgentsResponse201McpConfigHeaders
    from ..models.post_v1_agents_response_201_mcp_config_stdio import PostV1AgentsResponse201McpConfigStdio


T = TypeVar("T", bound="PostV1AgentsResponse201McpConfig")


@_attrs_define
class PostV1AgentsResponse201McpConfig:
    """
    Attributes:
        url (str):
        headers (PostV1AgentsResponse201McpConfigHeaders):
        stdio (PostV1AgentsResponse201McpConfigStdio):
    """

    url: str
    headers: PostV1AgentsResponse201McpConfigHeaders
    stdio: PostV1AgentsResponse201McpConfigStdio

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_v1_agents_response_201_mcp_config_headers import PostV1AgentsResponse201McpConfigHeaders  # noqa: PLC0415
        from ..models.post_v1_agents_response_201_mcp_config_stdio import PostV1AgentsResponse201McpConfigStdio  # noqa: PLC0415

        url = self.url

        headers = self.headers.to_dict()

        stdio = self.stdio.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "url": url,
                "headers": headers,
                "stdio": stdio,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_v1_agents_response_201_mcp_config_headers import PostV1AgentsResponse201McpConfigHeaders  # noqa: PLC0415
        from ..models.post_v1_agents_response_201_mcp_config_stdio import PostV1AgentsResponse201McpConfigStdio  # noqa: PLC0415

        d = dict(src_dict)
        url = d.pop("url")

        headers = PostV1AgentsResponse201McpConfigHeaders.from_dict(d.pop("headers"))

        stdio = PostV1AgentsResponse201McpConfigStdio.from_dict(d.pop("stdio"))

        post_v1_agents_response_201_mcp_config = cls(
            url=url,
            headers=headers,
            stdio=stdio,
        )

        return post_v1_agents_response_201_mcp_config
