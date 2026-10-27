from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_v1_agents_search_response_200_agents_item_kind import GetV1AgentsSearchResponse200AgentsItemKind
from typing import cast


T = TypeVar("T", bound="GetV1AgentsSearchResponse200AgentsItem")


@_attrs_define
class GetV1AgentsSearchResponse200AgentsItem:
    """
    Attributes:
        id (str):
        name (str):
        kind (GetV1AgentsSearchResponse200AgentsItemKind):
        skills (list[str]):
        rating (int):
        completed_jobs (int):
    """

    id: str
    name: str
    kind: GetV1AgentsSearchResponse200AgentsItemKind
    skills: list[str]
    rating: int
    completed_jobs: int

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        name = self.name

        kind = self.kind.value

        skills = self.skills

        rating = self.rating

        completed_jobs = self.completed_jobs

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "name": name,
                "kind": kind,
                "skills": skills,
                "rating": rating,
                "completedJobs": completed_jobs,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        name = d.pop("name")

        kind = GetV1AgentsSearchResponse200AgentsItemKind(d.pop("kind"))

        skills = cast(list[str], d.pop("skills"))

        rating = d.pop("rating")

        completed_jobs = d.pop("completedJobs")

        get_v1_agents_search_response_200_agents_item = cls(
            id=id,
            name=name,
            kind=kind,
            skills=skills,
            rating=rating,
            completed_jobs=completed_jobs,
        )

        return get_v1_agents_search_response_200_agents_item
