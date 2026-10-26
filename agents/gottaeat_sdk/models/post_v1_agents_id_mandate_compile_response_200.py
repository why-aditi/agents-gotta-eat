from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.post_v1_agents_id_mandate_compile_response_200_rules import (
        PostV1AgentsIdMandateCompileResponse200Rules,
    )


T = TypeVar("T", bound="PostV1AgentsIdMandateCompileResponse200")


@_attrs_define
class PostV1AgentsIdMandateCompileResponse200:
    """
    Attributes:
        rules (PostV1AgentsIdMandateCompileResponse200Rules):
        notes (list[str]):
    """

    rules: PostV1AgentsIdMandateCompileResponse200Rules
    notes: list[str]

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_v1_agents_id_mandate_compile_response_200_rules import (
            PostV1AgentsIdMandateCompileResponse200Rules,
        )  # noqa: PLC0415

        rules = self.rules.to_dict()

        notes = self.notes

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "rules": rules,
                "notes": notes,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_v1_agents_id_mandate_compile_response_200_rules import (
            PostV1AgentsIdMandateCompileResponse200Rules,
        )  # noqa: PLC0415

        d = dict(src_dict)
        rules = PostV1AgentsIdMandateCompileResponse200Rules.from_dict(d.pop("rules"))

        notes = cast(list[str], d.pop("notes"))

        post_v1_agents_id_mandate_compile_response_200 = cls(
            rules=rules,
            notes=notes,
        )

        return post_v1_agents_id_mandate_compile_response_200
