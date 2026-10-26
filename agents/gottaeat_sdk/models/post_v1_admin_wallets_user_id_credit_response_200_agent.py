from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.post_v1_admin_wallets_user_id_credit_response_200_agent_limits_type_0 import (
        PostV1AdminWalletsUserIdCreditResponse200AgentLimitsType0,
    )


T = TypeVar("T", bound="PostV1AdminWalletsUserIdCreditResponse200Agent")


@_attrs_define
class PostV1AdminWalletsUserIdCreditResponse200Agent:
    """
    Attributes:
        agent_id (str):
        today_spent_cents (int):
        limits (None | PostV1AdminWalletsUserIdCreditResponse200AgentLimitsType0):
    """

    agent_id: str
    today_spent_cents: int
    limits: None | PostV1AdminWalletsUserIdCreditResponse200AgentLimitsType0

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_v1_admin_wallets_user_id_credit_response_200_agent_limits_type_0 import (
            PostV1AdminWalletsUserIdCreditResponse200AgentLimitsType0,
        )  # noqa: PLC0415

        agent_id = self.agent_id

        today_spent_cents = self.today_spent_cents

        limits: dict[str, Any] | None
        if isinstance(self.limits, PostV1AdminWalletsUserIdCreditResponse200AgentLimitsType0):
            limits = self.limits.to_dict()
        else:
            limits = self.limits

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "agentId": agent_id,
                "todaySpentCents": today_spent_cents,
                "limits": limits,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_v1_admin_wallets_user_id_credit_response_200_agent_limits_type_0 import (
            PostV1AdminWalletsUserIdCreditResponse200AgentLimitsType0,
        )  # noqa: PLC0415

        d = dict(src_dict)
        agent_id = d.pop("agentId")

        today_spent_cents = d.pop("todaySpentCents")

        def _parse_limits(data: object) -> None | PostV1AdminWalletsUserIdCreditResponse200AgentLimitsType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                limits_type_0 = PostV1AdminWalletsUserIdCreditResponse200AgentLimitsType0.from_dict(data)

                return limits_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | PostV1AdminWalletsUserIdCreditResponse200AgentLimitsType0, data)

        limits = _parse_limits(d.pop("limits"))

        post_v1_admin_wallets_user_id_credit_response_200_agent = cls(
            agent_id=agent_id,
            today_spent_cents=today_spent_cents,
            limits=limits,
        )

        return post_v1_admin_wallets_user_id_credit_response_200_agent
