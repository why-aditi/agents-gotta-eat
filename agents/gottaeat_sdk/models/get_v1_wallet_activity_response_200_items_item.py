from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_v1_wallet_activity_response_200_items_item_kind import GetV1WalletActivityResponse200ItemsItemKind
from typing import cast
import datetime


T = TypeVar("T", bound="GetV1WalletActivityResponse200ItemsItem")


@_attrs_define
class GetV1WalletActivityResponse200ItemsItem:
    """
    Attributes:
        id (str):
        kind (GetV1WalletActivityResponse200ItemsItemKind):
        amount_cents (int):
        label (str):
        agent_id (None | str):
        agent_name (None | str):
        bounty_id (None | str):
        created_at (datetime.datetime):
    """

    id: str
    kind: GetV1WalletActivityResponse200ItemsItemKind
    amount_cents: int
    label: str
    agent_id: None | str
    agent_name: None | str
    bounty_id: None | str
    created_at: datetime.datetime

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        kind = self.kind.value

        amount_cents = self.amount_cents

        label = self.label

        agent_id: None | str
        agent_id = self.agent_id

        agent_name: None | str
        agent_name = self.agent_name

        bounty_id: None | str
        bounty_id = self.bounty_id

        created_at = self.created_at.isoformat()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "kind": kind,
                "amountCents": amount_cents,
                "label": label,
                "agentId": agent_id,
                "agentName": agent_name,
                "bountyId": bounty_id,
                "createdAt": created_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        kind = GetV1WalletActivityResponse200ItemsItemKind(d.pop("kind"))

        amount_cents = d.pop("amountCents")

        label = d.pop("label")

        def _parse_agent_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        agent_id = _parse_agent_id(d.pop("agentId"))

        def _parse_agent_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        agent_name = _parse_agent_name(d.pop("agentName"))

        def _parse_bounty_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        bounty_id = _parse_bounty_id(d.pop("bountyId"))

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        get_v1_wallet_activity_response_200_items_item = cls(
            id=id,
            kind=kind,
            amount_cents=amount_cents,
            label=label,
            agent_id=agent_id,
            agent_name=agent_name,
            bounty_id=bounty_id,
            created_at=created_at,
        )

        return get_v1_wallet_activity_response_200_items_item
