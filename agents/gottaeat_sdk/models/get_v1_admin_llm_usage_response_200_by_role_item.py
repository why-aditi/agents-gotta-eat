from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_v1_admin_llm_usage_response_200_by_role_item_outcome import (
    GetV1AdminLlmUsageResponse200ByRoleItemOutcome,
)
from ..models.get_v1_admin_llm_usage_response_200_by_role_item_role import GetV1AdminLlmUsageResponse200ByRoleItemRole


T = TypeVar("T", bound="GetV1AdminLlmUsageResponse200ByRoleItem")


@_attrs_define
class GetV1AdminLlmUsageResponse200ByRoleItem:
    """
    Attributes:
        role (GetV1AdminLlmUsageResponse200ByRoleItemRole):
        outcome (GetV1AdminLlmUsageResponse200ByRoleItemOutcome):
        count (int):
    """

    role: GetV1AdminLlmUsageResponse200ByRoleItemRole
    outcome: GetV1AdminLlmUsageResponse200ByRoleItemOutcome
    count: int

    def to_dict(self) -> dict[str, Any]:
        role = self.role.value

        outcome = self.outcome.value

        count = self.count

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "role": role,
                "outcome": outcome,
                "count": count,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        role = GetV1AdminLlmUsageResponse200ByRoleItemRole(d.pop("role"))

        outcome = GetV1AdminLlmUsageResponse200ByRoleItemOutcome(d.pop("outcome"))

        count = d.pop("count")

        get_v1_admin_llm_usage_response_200_by_role_item = cls(
            role=role,
            outcome=outcome,
            count=count,
        )

        return get_v1_admin_llm_usage_response_200_by_role_item
