from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.get_v1_wallet_response_200_agent_limits_type_0 import GetV1WalletResponse200AgentLimitsType0


T = TypeVar("T", bound="GetV1WalletResponse200Agent")


@_attrs_define
class GetV1WalletResponse200Agent:
    """
    Attributes:
        agent_id (str):
        today_spent_cents (int):
        limits (GetV1WalletResponse200AgentLimitsType0 | None):
    """

    agent_id: str
    today_spent_cents: int
    limits: GetV1WalletResponse200AgentLimitsType0 | None

    def to_dict(self) -> dict[str, Any]:
        from ..models.get_v1_wallet_response_200_agent_limits_type_0 import GetV1WalletResponse200AgentLimitsType0  # noqa: PLC0415

        agent_id = self.agent_id

        today_spent_cents = self.today_spent_cents

        limits: dict[str, Any] | None
        if isinstance(self.limits, GetV1WalletResponse200AgentLimitsType0):
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
        from ..models.get_v1_wallet_response_200_agent_limits_type_0 import GetV1WalletResponse200AgentLimitsType0  # noqa: PLC0415

        d = dict(src_dict)
        agent_id = d.pop("agentId")

        today_spent_cents = d.pop("todaySpentCents")

        def _parse_limits(data: object) -> GetV1WalletResponse200AgentLimitsType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                limits_type_0 = GetV1WalletResponse200AgentLimitsType0.from_dict(data)

                return limits_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(GetV1WalletResponse200AgentLimitsType0 | None, data)

        limits = _parse_limits(d.pop("limits"))

        get_v1_wallet_response_200_agent = cls(
            agent_id=agent_id,
            today_spent_cents=today_spent_cents,
            limits=limits,
        )

        return get_v1_wallet_response_200_agent
