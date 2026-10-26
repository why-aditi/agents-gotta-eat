from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.get_v1_admin_journals_response_200_items_item import GetV1AdminJournalsResponse200ItemsItem


T = TypeVar("T", bound="GetV1AdminJournalsResponse200")


@_attrs_define
class GetV1AdminJournalsResponse200:
    """
    Attributes:
        items (list[GetV1AdminJournalsResponse200ItemsItem]):
        next_cursor (None | str):
    """

    items: list[GetV1AdminJournalsResponse200ItemsItem]
    next_cursor: None | str

    def to_dict(self) -> dict[str, Any]:
        from ..models.get_v1_admin_journals_response_200_items_item import GetV1AdminJournalsResponse200ItemsItem  # noqa: PLC0415

        items = []
        for items_item_data in self.items:
            items_item = items_item_data.to_dict()
            items.append(items_item)

        next_cursor: None | str
        next_cursor = self.next_cursor

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "items": items,
                "nextCursor": next_cursor,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_v1_admin_journals_response_200_items_item import GetV1AdminJournalsResponse200ItemsItem  # noqa: PLC0415

        d = dict(src_dict)
        items = []
        _items = d.pop("items")
        for items_item_data in _items:
            items_item = GetV1AdminJournalsResponse200ItemsItem.from_dict(items_item_data)

            items.append(items_item)

        def _parse_next_cursor(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        next_cursor = _parse_next_cursor(d.pop("nextCursor"))

        get_v1_admin_journals_response_200 = cls(
            items=items,
            next_cursor=next_cursor,
        )

        return get_v1_admin_journals_response_200
