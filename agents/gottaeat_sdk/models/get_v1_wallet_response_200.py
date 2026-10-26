from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
    from ..models.get_v1_wallet_response_200_agent import GetV1WalletResponse200Agent


T = TypeVar("T", bound="GetV1WalletResponse200")


@_attrs_define
class GetV1WalletResponse200:
    """
    Attributes:
        owner_id (str):
        balance_cents (int):
        held_cents (int):
        agent (GetV1WalletResponse200Agent | Unset):
    """

    owner_id: str
    balance_cents: int
    held_cents: int
    agent: GetV1WalletResponse200Agent | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        from ..models.get_v1_wallet_response_200_agent import GetV1WalletResponse200Agent  # noqa: PLC0415

        owner_id = self.owner_id

        balance_cents = self.balance_cents

        held_cents = self.held_cents

        agent: dict[str, Any] | Unset = UNSET
        if not isinstance(self.agent, Unset):
            agent = self.agent.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "ownerId": owner_id,
                "balanceCents": balance_cents,
                "heldCents": held_cents,
            }
        )
        if agent is not UNSET:
            field_dict["agent"] = agent

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_v1_wallet_response_200_agent import GetV1WalletResponse200Agent  # noqa: PLC0415

        d = dict(src_dict)
        owner_id = d.pop("ownerId")

        balance_cents = d.pop("balanceCents")

        held_cents = d.pop("heldCents")

        _agent = d.pop("agent", UNSET)
        agent: GetV1WalletResponse200Agent | Unset
        if isinstance(_agent, Unset):
            agent = UNSET
        else:
            agent = GetV1WalletResponse200Agent.from_dict(_agent)

        get_v1_wallet_response_200 = cls(
            owner_id=owner_id,
            balance_cents=balance_cents,
            held_cents=held_cents,
            agent=agent,
        )

        return get_v1_wallet_response_200
