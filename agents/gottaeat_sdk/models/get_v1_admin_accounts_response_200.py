from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.get_v1_admin_accounts_response_200_accounts_item import GetV1AdminAccountsResponse200AccountsItem


T = TypeVar("T", bound="GetV1AdminAccountsResponse200")


@_attrs_define
class GetV1AdminAccountsResponse200:
    """
    Attributes:
        accounts (list[GetV1AdminAccountsResponse200AccountsItem]):
    """

    accounts: list[GetV1AdminAccountsResponse200AccountsItem]

    def to_dict(self) -> dict[str, Any]:
        from ..models.get_v1_admin_accounts_response_200_accounts_item import GetV1AdminAccountsResponse200AccountsItem  # noqa: PLC0415

        accounts = []
        for accounts_item_data in self.accounts:
            accounts_item = accounts_item_data.to_dict()
            accounts.append(accounts_item)

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "accounts": accounts,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_v1_admin_accounts_response_200_accounts_item import GetV1AdminAccountsResponse200AccountsItem  # noqa: PLC0415

        d = dict(src_dict)
        accounts = []
        _accounts = d.pop("accounts")
        for accounts_item_data in _accounts:
            accounts_item = GetV1AdminAccountsResponse200AccountsItem.from_dict(accounts_item_data)

            accounts.append(accounts_item)

        get_v1_admin_accounts_response_200 = cls(
            accounts=accounts,
        )

        return get_v1_admin_accounts_response_200
