from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.post_v1_agents_id_rotate_key_response_200_agent_kind import PostV1AgentsIdRotateKeyResponse200AgentKind
from ..types import UNSET, Unset
from typing import cast
import datetime

if TYPE_CHECKING:
    from ..models.post_v1_agents_id_rotate_key_response_200_agent_today import (
        PostV1AgentsIdRotateKeyResponse200AgentToday,
    )


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
        skills (list[str]):
        completed_jobs (int):
        api_key_prefix (None | str):
        created_at (datetime.datetime):
        today (PostV1AgentsIdRotateKeyResponse200AgentToday | Unset):
    """

    id: str
    owner_id: str
    name: str
    kind: PostV1AgentsIdRotateKeyResponse200AgentKind
    status: str
    rating: int
    skills: list[str]
    completed_jobs: int
    api_key_prefix: None | str
    created_at: datetime.datetime
    today: PostV1AgentsIdRotateKeyResponse200AgentToday | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_v1_agents_id_rotate_key_response_200_agent_today import (
            PostV1AgentsIdRotateKeyResponse200AgentToday,
        )  # noqa: PLC0415

        id = self.id

        owner_id = self.owner_id

        name = self.name

        kind = self.kind.value

        status = self.status

        rating = self.rating

        skills = self.skills

        completed_jobs = self.completed_jobs

        api_key_prefix: None | str
        api_key_prefix = self.api_key_prefix

        created_at = self.created_at.isoformat()

        today: dict[str, Any] | Unset = UNSET
        if not isinstance(self.today, Unset):
            today = self.today.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "ownerId": owner_id,
                "name": name,
                "kind": kind,
                "status": status,
                "rating": rating,
                "skills": skills,
                "completedJobs": completed_jobs,
                "apiKeyPrefix": api_key_prefix,
                "createdAt": created_at,
            }
        )
        if today is not UNSET:
            field_dict["today"] = today

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_v1_agents_id_rotate_key_response_200_agent_today import (
            PostV1AgentsIdRotateKeyResponse200AgentToday,
        )  # noqa: PLC0415

        d = dict(src_dict)
        id = d.pop("id")

        owner_id = d.pop("ownerId")

        name = d.pop("name")

        kind = PostV1AgentsIdRotateKeyResponse200AgentKind(d.pop("kind"))

        status = d.pop("status")

        rating = d.pop("rating")

        skills = cast(list[str], d.pop("skills"))

        completed_jobs = d.pop("completedJobs")

        def _parse_api_key_prefix(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        api_key_prefix = _parse_api_key_prefix(d.pop("apiKeyPrefix"))

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        _today = d.pop("today", UNSET)
        today: PostV1AgentsIdRotateKeyResponse200AgentToday | Unset
        if isinstance(_today, Unset):
            today = UNSET
        else:
            today = PostV1AgentsIdRotateKeyResponse200AgentToday.from_dict(_today)

        post_v1_agents_id_rotate_key_response_200_agent = cls(
            id=id,
            owner_id=owner_id,
            name=name,
            kind=kind,
            status=status,
            rating=rating,
            skills=skills,
            completed_jobs=completed_jobs,
            api_key_prefix=api_key_prefix,
            created_at=created_at,
            today=today,
        )

        return post_v1_agents_id_rotate_key_response_200_agent
