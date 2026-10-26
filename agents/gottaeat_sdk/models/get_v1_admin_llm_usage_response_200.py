from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.get_v1_admin_llm_usage_response_200_by_role_item import GetV1AdminLlmUsageResponse200ByRoleItem
    from ..models.get_v1_admin_llm_usage_response_200_recent_item import GetV1AdminLlmUsageResponse200RecentItem


T = TypeVar("T", bound="GetV1AdminLlmUsageResponse200")


@_attrs_define
class GetV1AdminLlmUsageResponse200:
    """
    Attributes:
        day (str):
        budget (int):
        used (int):
        by_role (list[GetV1AdminLlmUsageResponse200ByRoleItem]):
        recent (list[GetV1AdminLlmUsageResponse200RecentItem]):
    """

    day: str
    budget: int
    used: int
    by_role: list[GetV1AdminLlmUsageResponse200ByRoleItem]
    recent: list[GetV1AdminLlmUsageResponse200RecentItem]

    def to_dict(self) -> dict[str, Any]:
        from ..models.get_v1_admin_llm_usage_response_200_by_role_item import GetV1AdminLlmUsageResponse200ByRoleItem  # noqa: PLC0415
        from ..models.get_v1_admin_llm_usage_response_200_recent_item import GetV1AdminLlmUsageResponse200RecentItem  # noqa: PLC0415

        day = self.day

        budget = self.budget

        used = self.used

        by_role = []
        for by_role_item_data in self.by_role:
            by_role_item = by_role_item_data.to_dict()
            by_role.append(by_role_item)

        recent = []
        for recent_item_data in self.recent:
            recent_item = recent_item_data.to_dict()
            recent.append(recent_item)

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "day": day,
                "budget": budget,
                "used": used,
                "byRole": by_role,
                "recent": recent,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_v1_admin_llm_usage_response_200_by_role_item import GetV1AdminLlmUsageResponse200ByRoleItem  # noqa: PLC0415
        from ..models.get_v1_admin_llm_usage_response_200_recent_item import GetV1AdminLlmUsageResponse200RecentItem  # noqa: PLC0415

        d = dict(src_dict)
        day = d.pop("day")

        budget = d.pop("budget")

        used = d.pop("used")

        by_role = []
        _by_role = d.pop("byRole")
        for by_role_item_data in _by_role:
            by_role_item = GetV1AdminLlmUsageResponse200ByRoleItem.from_dict(by_role_item_data)

            by_role.append(by_role_item)

        recent = []
        _recent = d.pop("recent")
        for recent_item_data in _recent:
            recent_item = GetV1AdminLlmUsageResponse200RecentItem.from_dict(recent_item_data)

            recent.append(recent_item)

        get_v1_admin_llm_usage_response_200 = cls(
            day=day,
            budget=budget,
            used=used,
            by_role=by_role,
            recent=recent,
        )

        return get_v1_admin_llm_usage_response_200
