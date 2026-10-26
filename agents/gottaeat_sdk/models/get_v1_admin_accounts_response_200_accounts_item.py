from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_v1_admin_accounts_response_200_accounts_item_type import GetV1AdminAccountsResponse200AccountsItemType
from typing import cast
import datetime


T = TypeVar("T", bound="GetV1AdminAccountsResponse200AccountsItem")


@_attrs_define
class GetV1AdminAccountsResponse200AccountsItem:
    """
    Attributes:
        id (str):
        type_ (GetV1AdminAccountsResponse200AccountsItemType):
        owner_id (None | str):
        memo (bool):
        balance_cents (int):
        cached_balance_cents (int | None):
        created_at (datetime.datetime):
    """

    id: str
    type_: GetV1AdminAccountsResponse200AccountsItemType
    owner_id: None | str
    memo: bool
    balance_cents: int
    cached_balance_cents: int | None
    created_at: datetime.datetime

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        type_ = self.type_.value

        owner_id: None | str
        owner_id = self.owner_id

        memo = self.memo

        balance_cents = self.balance_cents

        cached_balance_cents: int | None
        cached_balance_cents = self.cached_balance_cents

        created_at = self.created_at.isoformat()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "type": type_,
                "ownerId": owner_id,
                "memo": memo,
                "balanceCents": balance_cents,
                "cachedBalanceCents": cached_balance_cents,
                "createdAt": created_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        type_ = GetV1AdminAccountsResponse200AccountsItemType(d.pop("type"))

        def _parse_owner_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        owner_id = _parse_owner_id(d.pop("ownerId"))

        memo = d.pop("memo")

        balance_cents = d.pop("balanceCents")

        def _parse_cached_balance_cents(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        cached_balance_cents = _parse_cached_balance_cents(d.pop("cachedBalanceCents"))

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        get_v1_admin_accounts_response_200_accounts_item = cls(
            id=id,
            type_=type_,
            owner_id=owner_id,
            memo=memo,
            balance_cents=balance_cents,
            cached_balance_cents=cached_balance_cents,
            created_at=created_at,
        )

        return get_v1_admin_accounts_response_200_accounts_item
