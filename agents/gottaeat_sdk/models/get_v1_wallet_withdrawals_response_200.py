from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.get_v1_wallet_withdrawals_response_200_payouts_item import (
        GetV1WalletWithdrawalsResponse200PayoutsItem,
    )


T = TypeVar("T", bound="GetV1WalletWithdrawalsResponse200")


@_attrs_define
class GetV1WalletWithdrawalsResponse200:
    """
    Attributes:
        payouts (list[GetV1WalletWithdrawalsResponse200PayoutsItem]):
    """

    payouts: list[GetV1WalletWithdrawalsResponse200PayoutsItem]

    def to_dict(self) -> dict[str, Any]:
        from ..models.get_v1_wallet_withdrawals_response_200_payouts_item import (
            GetV1WalletWithdrawalsResponse200PayoutsItem,
        )  # noqa: PLC0415

        payouts = []
        for payouts_item_data in self.payouts:
            payouts_item = payouts_item_data.to_dict()
            payouts.append(payouts_item)

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "payouts": payouts,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_v1_wallet_withdrawals_response_200_payouts_item import (
            GetV1WalletWithdrawalsResponse200PayoutsItem,
        )  # noqa: PLC0415

        d = dict(src_dict)
        payouts = []
        _payouts = d.pop("payouts")
        for payouts_item_data in _payouts:
            payouts_item = GetV1WalletWithdrawalsResponse200PayoutsItem.from_dict(payouts_item_data)

            payouts.append(payouts_item)

        get_v1_wallet_withdrawals_response_200 = cls(
            payouts=payouts,
        )

        return get_v1_wallet_withdrawals_response_200
