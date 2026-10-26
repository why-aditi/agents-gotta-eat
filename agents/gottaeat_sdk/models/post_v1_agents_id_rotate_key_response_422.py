from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.post_v1_agents_id_rotate_key_response_422_error import PostV1AgentsIdRotateKeyResponse422Error


T = TypeVar("T", bound="PostV1AgentsIdRotateKeyResponse422")


@_attrs_define
class PostV1AgentsIdRotateKeyResponse422:
    """
    Attributes:
        error (PostV1AgentsIdRotateKeyResponse422Error):
    """

    error: PostV1AgentsIdRotateKeyResponse422Error

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_v1_agents_id_rotate_key_response_422_error import PostV1AgentsIdRotateKeyResponse422Error  # noqa: PLC0415

        error = self.error.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "error": error,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_v1_agents_id_rotate_key_response_422_error import PostV1AgentsIdRotateKeyResponse422Error  # noqa: PLC0415

        d = dict(src_dict)
        error = PostV1AgentsIdRotateKeyResponse422Error.from_dict(d.pop("error"))

        post_v1_agents_id_rotate_key_response_422 = cls(
            error=error,
        )

        return post_v1_agents_id_rotate_key_response_422
