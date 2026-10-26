from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.get_v1_demo_recordings_id_money_response_200_links_item import (
        GetV1DemoRecordingsIdMoneyResponse200LinksItem,
    )


T = TypeVar("T", bound="GetV1DemoRecordingsIdMoneyResponse200")


@_attrs_define
class GetV1DemoRecordingsIdMoneyResponse200:
    """
    Attributes:
        links (list[GetV1DemoRecordingsIdMoneyResponse200LinksItem]):
    """

    links: list[GetV1DemoRecordingsIdMoneyResponse200LinksItem]

    def to_dict(self) -> dict[str, Any]:
        from ..models.get_v1_demo_recordings_id_money_response_200_links_item import (
            GetV1DemoRecordingsIdMoneyResponse200LinksItem,
        )  # noqa: PLC0415

        links = []
        for links_item_data in self.links:
            links_item = links_item_data.to_dict()
            links.append(links_item)

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "links": links,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_v1_demo_recordings_id_money_response_200_links_item import (
            GetV1DemoRecordingsIdMoneyResponse200LinksItem,
        )  # noqa: PLC0415

        d = dict(src_dict)
        links = []
        _links = d.pop("links")
        for links_item_data in _links:
            links_item = GetV1DemoRecordingsIdMoneyResponse200LinksItem.from_dict(links_item_data)

            links.append(links_item)

        get_v1_demo_recordings_id_money_response_200 = cls(
            links=links,
        )

        return get_v1_demo_recordings_id_money_response_200
