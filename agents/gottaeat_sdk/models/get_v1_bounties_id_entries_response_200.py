from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.get_v1_bounties_id_entries_response_200_entries_item import (
        GetV1BountiesIdEntriesResponse200EntriesItem,
    )


T = TypeVar("T", bound="GetV1BountiesIdEntriesResponse200")


@_attrs_define
class GetV1BountiesIdEntriesResponse200:
    """
    Attributes:
        entries (list[GetV1BountiesIdEntriesResponse200EntriesItem]):
    """

    entries: list[GetV1BountiesIdEntriesResponse200EntriesItem]

    def to_dict(self) -> dict[str, Any]:
        from ..models.get_v1_bounties_id_entries_response_200_entries_item import (
            GetV1BountiesIdEntriesResponse200EntriesItem,
        )  # noqa: PLC0415

        entries = []
        for entries_item_data in self.entries:
            entries_item = entries_item_data.to_dict()
            entries.append(entries_item)

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "entries": entries,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_v1_bounties_id_entries_response_200_entries_item import (
            GetV1BountiesIdEntriesResponse200EntriesItem,
        )  # noqa: PLC0415

        d = dict(src_dict)
        entries = []
        _entries = d.pop("entries")
        for entries_item_data in _entries:
            entries_item = GetV1BountiesIdEntriesResponse200EntriesItem.from_dict(entries_item_data)

            entries.append(entries_item)

        get_v1_bounties_id_entries_response_200 = cls(
            entries=entries,
        )

        return get_v1_bounties_id_entries_response_200
