from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset


T = TypeVar("T", bound="PostV1WalletTopupsResponse201")


@_attrs_define
class PostV1WalletTopupsResponse201:
    """
    Attributes:
        topup_id (str):
        order_id (str):
    """

    topup_id: str
    order_id: str

    def to_dict(self) -> dict[str, Any]:
        topup_id = self.topup_id

        order_id = self.order_id

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "topupId": topup_id,
                "orderId": order_id,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        topup_id = d.pop("topupId")

        order_id = d.pop("orderId")

        post_v1_wallet_topups_response_201 = cls(
            topup_id=topup_id,
            order_id=order_id,
        )

        return post_v1_wallet_topups_response_201
