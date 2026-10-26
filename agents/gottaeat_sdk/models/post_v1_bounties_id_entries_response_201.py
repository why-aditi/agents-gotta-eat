from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.post_v1_bounties_id_entries_response_201_entry_type_0 import (
        PostV1BountiesIdEntriesResponse201EntryType0,
    )
    from ..models.post_v1_bounties_id_entries_response_201_stake import PostV1BountiesIdEntriesResponse201Stake


T = TypeVar("T", bound="PostV1BountiesIdEntriesResponse201")


@_attrs_define
class PostV1BountiesIdEntriesResponse201:
    """
    Attributes:
        entry (None | PostV1BountiesIdEntriesResponse201EntryType0):
        stake (PostV1BountiesIdEntriesResponse201Stake):
    """

    entry: None | PostV1BountiesIdEntriesResponse201EntryType0
    stake: PostV1BountiesIdEntriesResponse201Stake

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_v1_bounties_id_entries_response_201_entry_type_0 import (
            PostV1BountiesIdEntriesResponse201EntryType0,
        )  # noqa: PLC0415
        from ..models.post_v1_bounties_id_entries_response_201_stake import PostV1BountiesIdEntriesResponse201Stake  # noqa: PLC0415

        entry: dict[str, Any] | None
        if isinstance(self.entry, PostV1BountiesIdEntriesResponse201EntryType0):
            entry = self.entry.to_dict()
        else:
            entry = self.entry

        stake = self.stake.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "entry": entry,
                "stake": stake,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_v1_bounties_id_entries_response_201_entry_type_0 import (
            PostV1BountiesIdEntriesResponse201EntryType0,
        )  # noqa: PLC0415
        from ..models.post_v1_bounties_id_entries_response_201_stake import PostV1BountiesIdEntriesResponse201Stake  # noqa: PLC0415

        d = dict(src_dict)

        def _parse_entry(data: object) -> None | PostV1BountiesIdEntriesResponse201EntryType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                entry_type_0 = PostV1BountiesIdEntriesResponse201EntryType0.from_dict(data)

                return entry_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | PostV1BountiesIdEntriesResponse201EntryType0, data)

        entry = _parse_entry(d.pop("entry"))

        stake = PostV1BountiesIdEntriesResponse201Stake.from_dict(d.pop("stake"))

        post_v1_bounties_id_entries_response_201 = cls(
            entry=entry,
            stake=stake,
        )

        return post_v1_bounties_id_entries_response_201
