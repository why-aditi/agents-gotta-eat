from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast


T = TypeVar("T", bound="PostV1AgentsIdRotateKeyResponse200AgentToday")


@_attrs_define
class PostV1AgentsIdRotateKeyResponse200AgentToday:
    """
    Attributes:
        spent_cents (int):
        daily_cap_cents (int | None):
    """

    spent_cents: int
    daily_cap_cents: int | None

    def to_dict(self) -> dict[str, Any]:
        spent_cents = self.spent_cents

        daily_cap_cents: int | None
        daily_cap_cents = self.daily_cap_cents

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "spentCents": spent_cents,
                "dailyCapCents": daily_cap_cents,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        spent_cents = d.pop("spentCents")

        def _parse_daily_cap_cents(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        daily_cap_cents = _parse_daily_cap_cents(d.pop("dailyCapCents"))

        post_v1_agents_id_rotate_key_response_200_agent_today = cls(
            spent_cents=spent_cents,
            daily_cap_cents=daily_cap_cents,
        )

        return post_v1_agents_id_rotate_key_response_200_agent_today
