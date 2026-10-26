from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.post_v1_agents_id_rotate_key_response_200_agent_kind import PostV1AgentsIdRotateKeyResponse200AgentKind
from typing import cast
import datetime


T = TypeVar("T", bound="PostV1AgentsIdRotateKeyResponse200Agent")


@_attrs_define
class PostV1AgentsIdRotateKeyResponse200Agent:
    """
    Attributes:
        id (str):
        owner_id (str):
        name (str):
        kind (PostV1AgentsIdRotateKeyResponse200AgentKind):
        status (str):
        rating (int):
        api_key_prefix (None | str):
        created_at (datetime.datetime):
    """

    id: str
    owner_id: str
    name: str
    kind: PostV1AgentsIdRotateKeyResponse200AgentKind
    status: str
    rating: int
    api_key_prefix: None | str
    created_at: datetime.datetime

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        owner_id = self.owner_id

        name = self.name

        kind = self.kind.value

        status = self.status

        rating = self.rating

        api_key_prefix: None | str
        api_key_prefix = self.api_key_prefix

        created_at = self.created_at.isoformat()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "ownerId": owner_id,
                "name": name,
                "kind": kind,
                "status": status,
                "rating": rating,
                "apiKeyPrefix": api_key_prefix,
                "createdAt": created_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        owner_id = d.pop("ownerId")

        name = d.pop("name")

        kind = PostV1AgentsIdRotateKeyResponse200AgentKind(d.pop("kind"))

        status = d.pop("status")

        rating = d.pop("rating")

        def _parse_api_key_prefix(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        api_key_prefix = _parse_api_key_prefix(d.pop("apiKeyPrefix"))

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        post_v1_agents_id_rotate_key_response_200_agent = cls(
            id=id,
            owner_id=owner_id,
            name=name,
            kind=kind,
            status=status,
            rating=rating,
            api_key_prefix=api_key_prefix,
            created_at=created_at,
        )

        return post_v1_agents_id_rotate_key_response_200_agent
