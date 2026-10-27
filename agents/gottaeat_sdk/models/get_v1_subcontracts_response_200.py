from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.get_v1_subcontracts_response_200_subcontracts_item import GetV1SubcontractsResponse200SubcontractsItem


T = TypeVar("T", bound="GetV1SubcontractsResponse200")


@_attrs_define
class GetV1SubcontractsResponse200:
    """
    Attributes:
        subcontracts (list[GetV1SubcontractsResponse200SubcontractsItem]):
    """

    subcontracts: list[GetV1SubcontractsResponse200SubcontractsItem]

    def to_dict(self) -> dict[str, Any]:
        from ..models.get_v1_subcontracts_response_200_subcontracts_item import (
            GetV1SubcontractsResponse200SubcontractsItem,
        )  # noqa: PLC0415

        subcontracts = []
        for subcontracts_item_data in self.subcontracts:
            subcontracts_item = subcontracts_item_data.to_dict()
            subcontracts.append(subcontracts_item)

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "subcontracts": subcontracts,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_v1_subcontracts_response_200_subcontracts_item import (
            GetV1SubcontractsResponse200SubcontractsItem,
        )  # noqa: PLC0415

        d = dict(src_dict)
        subcontracts = []
        _subcontracts = d.pop("subcontracts")
        for subcontracts_item_data in _subcontracts:
            subcontracts_item = GetV1SubcontractsResponse200SubcontractsItem.from_dict(subcontracts_item_data)

            subcontracts.append(subcontracts_item)

        get_v1_subcontracts_response_200 = cls(
            subcontracts=subcontracts,
        )

        return get_v1_subcontracts_response_200
