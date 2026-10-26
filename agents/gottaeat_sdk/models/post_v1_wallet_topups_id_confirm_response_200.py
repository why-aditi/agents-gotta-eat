from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.post_v1_wallet_topups_id_confirm_response_200_status import PostV1WalletTopupsIdConfirmResponse200Status


T = TypeVar("T", bound="PostV1WalletTopupsIdConfirmResponse200")


@_attrs_define
class PostV1WalletTopupsIdConfirmResponse200:
    """
    Attributes:
        id (str):
        amount_cents (int):
        fee_cents (int):
        status (PostV1WalletTopupsIdConfirmResponse200Status):
    """

    id: str
    amount_cents: int
    fee_cents: int
    status: PostV1WalletTopupsIdConfirmResponse200Status

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        amount_cents = self.amount_cents

        fee_cents = self.fee_cents

        status = self.status.value

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "amountCents": amount_cents,
                "feeCents": fee_cents,
                "status": status,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        amount_cents = d.pop("amountCents")

        fee_cents = d.pop("feeCents")

        status = PostV1WalletTopupsIdConfirmResponse200Status(d.pop("status"))

        post_v1_wallet_topups_id_confirm_response_200 = cls(
            id=id,
            amount_cents=amount_cents,
            fee_cents=fee_cents,
            status=status,
        )

        return post_v1_wallet_topups_id_confirm_response_200
