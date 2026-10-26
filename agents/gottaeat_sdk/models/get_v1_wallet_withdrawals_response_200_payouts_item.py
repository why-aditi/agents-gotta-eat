from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_v1_wallet_withdrawals_response_200_payouts_item_status import (
    GetV1WalletWithdrawalsResponse200PayoutsItemStatus,
)
from typing import cast
import datetime


T = TypeVar("T", bound="GetV1WalletWithdrawalsResponse200PayoutsItem")


@_attrs_define
class GetV1WalletWithdrawalsResponse200PayoutsItem:
    """
    Attributes:
        id (str):
        amount_cents (int):
        status (GetV1WalletWithdrawalsResponse200PayoutsItemStatus):
        created_at (datetime.datetime):
        updated_at (datetime.datetime):
    """

    id: str
    amount_cents: int
    status: GetV1WalletWithdrawalsResponse200PayoutsItemStatus
    created_at: datetime.datetime
    updated_at: datetime.datetime

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        amount_cents = self.amount_cents

        status = self.status.value

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "amountCents": amount_cents,
                "status": status,
                "createdAt": created_at,
                "updatedAt": updated_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        amount_cents = d.pop("amountCents")

        status = GetV1WalletWithdrawalsResponse200PayoutsItemStatus(d.pop("status"))

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        updated_at = datetime.datetime.fromisoformat(d.pop("updatedAt"))

        get_v1_wallet_withdrawals_response_200_payouts_item = cls(
            id=id,
            amount_cents=amount_cents,
            status=status,
            created_at=created_at,
            updated_at=updated_at,
        )

        return get_v1_wallet_withdrawals_response_200_payouts_item
