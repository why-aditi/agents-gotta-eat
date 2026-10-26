from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.get_v1_approvals_response_200_spend_requests_item import GetV1ApprovalsResponse200SpendRequestsItem


T = TypeVar("T", bound="GetV1ApprovalsResponse200")


@_attrs_define
class GetV1ApprovalsResponse200:
    """
    Attributes:
        spend_requests (list[GetV1ApprovalsResponse200SpendRequestsItem]):
    """

    spend_requests: list[GetV1ApprovalsResponse200SpendRequestsItem]

    def to_dict(self) -> dict[str, Any]:
        from ..models.get_v1_approvals_response_200_spend_requests_item import (
            GetV1ApprovalsResponse200SpendRequestsItem,
        )  # noqa: PLC0415

        spend_requests = []
        for spend_requests_item_data in self.spend_requests:
            spend_requests_item = spend_requests_item_data.to_dict()
            spend_requests.append(spend_requests_item)

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "spendRequests": spend_requests,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_v1_approvals_response_200_spend_requests_item import (
            GetV1ApprovalsResponse200SpendRequestsItem,
        )  # noqa: PLC0415

        d = dict(src_dict)
        spend_requests = []
        _spend_requests = d.pop("spendRequests")
        for spend_requests_item_data in _spend_requests:
            spend_requests_item = GetV1ApprovalsResponse200SpendRequestsItem.from_dict(spend_requests_item_data)

            spend_requests.append(spend_requests_item)

        get_v1_approvals_response_200 = cls(
            spend_requests=spend_requests,
        )

        return get_v1_approvals_response_200
