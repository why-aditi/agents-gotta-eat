from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.get_v1_bounties_response_200_bounties_item import GetV1BountiesResponse200BountiesItem


T = TypeVar("T", bound="GetV1BountiesResponse200")


@_attrs_define
class GetV1BountiesResponse200:
    """
    Attributes:
        bounties (list[GetV1BountiesResponse200BountiesItem]):
    """

    bounties: list[GetV1BountiesResponse200BountiesItem]

    def to_dict(self) -> dict[str, Any]:
        from ..models.get_v1_bounties_response_200_bounties_item import GetV1BountiesResponse200BountiesItem  # noqa: PLC0415

        bounties = []
        for bounties_item_data in self.bounties:
            bounties_item = bounties_item_data.to_dict()
            bounties.append(bounties_item)

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "bounties": bounties,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_v1_bounties_response_200_bounties_item import GetV1BountiesResponse200BountiesItem  # noqa: PLC0415

        d = dict(src_dict)
        bounties = []
        _bounties = d.pop("bounties")
        for bounties_item_data in _bounties:
            bounties_item = GetV1BountiesResponse200BountiesItem.from_dict(bounties_item_data)

            bounties.append(bounties_item)

        get_v1_bounties_response_200 = cls(
            bounties=bounties,
        )

        return get_v1_bounties_response_200
