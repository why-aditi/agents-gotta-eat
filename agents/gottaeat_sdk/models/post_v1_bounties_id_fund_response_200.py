from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset


T = TypeVar("T", bound="PostV1BountiesIdFundResponse200")


@_attrs_define
class PostV1BountiesIdFundResponse200:
    """
    Attributes:
        order_id (str):
    """

    order_id: str

    def to_dict(self) -> dict[str, Any]:
        order_id = self.order_id

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "orderId": order_id,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        order_id = d.pop("orderId")

        post_v1_bounties_id_fund_response_200 = cls(
            order_id=order_id,
        )

        return post_v1_bounties_id_fund_response_200
