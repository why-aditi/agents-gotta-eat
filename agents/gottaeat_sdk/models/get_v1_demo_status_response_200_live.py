from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset


T = TypeVar("T", bound="GetV1DemoStatusResponse200Live")


@_attrs_define
class GetV1DemoStatusResponse200Live:
    """
    Attributes:
        budget_used (int):
        budget (int):
        fallback (bool):
    """

    budget_used: int
    budget: int
    fallback: bool

    def to_dict(self) -> dict[str, Any]:
        budget_used = self.budget_used

        budget = self.budget

        fallback = self.fallback

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "budgetUsed": budget_used,
                "budget": budget,
                "fallback": fallback,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        budget_used = d.pop("budgetUsed")

        budget = d.pop("budget")

        fallback = d.pop("fallback")

        get_v1_demo_status_response_200_live = cls(
            budget_used=budget_used,
            budget=budget,
            fallback=fallback,
        )

        return get_v1_demo_status_response_200_live
