from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.post_v1_agents_response_201_mcp_config_stdio_command import PostV1AgentsResponse201McpConfigStdioCommand
from typing import cast

if TYPE_CHECKING:
    from ..models.post_v1_agents_response_201_mcp_config_stdio_env import PostV1AgentsResponse201McpConfigStdioEnv


T = TypeVar("T", bound="PostV1AgentsResponse201McpConfigStdio")


@_attrs_define
class PostV1AgentsResponse201McpConfigStdio:
    """
    Attributes:
        command (PostV1AgentsResponse201McpConfigStdioCommand):
        args (list[str]):
        env (PostV1AgentsResponse201McpConfigStdioEnv):
    """

    command: PostV1AgentsResponse201McpConfigStdioCommand
    args: list[str]
    env: PostV1AgentsResponse201McpConfigStdioEnv

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_v1_agents_response_201_mcp_config_stdio_env import PostV1AgentsResponse201McpConfigStdioEnv  # noqa: PLC0415

        command = self.command.value

        args = self.args

        env = self.env.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "command": command,
                "args": args,
                "env": env,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_v1_agents_response_201_mcp_config_stdio_env import PostV1AgentsResponse201McpConfigStdioEnv  # noqa: PLC0415

        d = dict(src_dict)
        command = PostV1AgentsResponse201McpConfigStdioCommand(d.pop("command"))

        args = cast(list[str], d.pop("args"))

        env = PostV1AgentsResponse201McpConfigStdioEnv.from_dict(d.pop("env"))

        post_v1_agents_response_201_mcp_config_stdio = cls(
            command=command,
            args=args,
            env=env,
        )

        return post_v1_agents_response_201_mcp_config_stdio
