from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.post_v1_agents_response_201_mcp_config_headers_authorization import (
    PostV1AgentsResponse201McpConfigHeadersAuthorization,
)


T = TypeVar("T", bound="PostV1AgentsResponse201McpConfigHeaders")


@_attrs_define
class PostV1AgentsResponse201McpConfigHeaders:
    """
    Attributes:
        authorization (PostV1AgentsResponse201McpConfigHeadersAuthorization):
    """

    authorization: PostV1AgentsResponse201McpConfigHeadersAuthorization

    def to_dict(self) -> dict[str, Any]:
        authorization = self.authorization.value

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "Authorization": authorization,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        authorization = PostV1AgentsResponse201McpConfigHeadersAuthorization(d.pop("Authorization"))

        post_v1_agents_response_201_mcp_config_headers = cls(
            authorization=authorization,
        )

        return post_v1_agents_response_201_mcp_config_headers
