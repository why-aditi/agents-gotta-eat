from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.post_v1_wallet_withdrawals_response_202_status import PostV1WalletWithdrawalsResponse202Status
from typing import cast
import datetime


T = TypeVar("T", bound="PostV1WalletWithdrawalsResponse202")


@_attrs_define
class PostV1WalletWithdrawalsResponse202:
    """
    Attributes:
        id (str):
        amount_cents (int):
        status (PostV1WalletWithdrawalsResponse202Status):
        created_at (datetime.datetime):
        updated_at (datetime.datetime):
    """

    id: str
    amount_cents: int
    status: PostV1WalletWithdrawalsResponse202Status
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

        status = PostV1WalletWithdrawalsResponse202Status(d.pop("status"))

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        updated_at = datetime.datetime.fromisoformat(d.pop("updatedAt"))

        post_v1_wallet_withdrawals_response_202 = cls(
            id=id,
            amount_cents=amount_cents,
            status=status,
            created_at=created_at,
            updated_at=updated_at,
        )

        return post_v1_wallet_withdrawals_response_202
