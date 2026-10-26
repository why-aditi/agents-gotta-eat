from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.get_v1_admin_recordings_response_200_recordings_item import (
        GetV1AdminRecordingsResponse200RecordingsItem,
    )


T = TypeVar("T", bound="GetV1AdminRecordingsResponse200")


@_attrs_define
class GetV1AdminRecordingsResponse200:
    """
    Attributes:
        recordings (list[GetV1AdminRecordingsResponse200RecordingsItem]):
    """

    recordings: list[GetV1AdminRecordingsResponse200RecordingsItem]

    def to_dict(self) -> dict[str, Any]:
        from ..models.get_v1_admin_recordings_response_200_recordings_item import (
            GetV1AdminRecordingsResponse200RecordingsItem,
        )  # noqa: PLC0415

        recordings = []
        for recordings_item_data in self.recordings:
            recordings_item = recordings_item_data.to_dict()
            recordings.append(recordings_item)

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "recordings": recordings,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_v1_admin_recordings_response_200_recordings_item import (
            GetV1AdminRecordingsResponse200RecordingsItem,
        )  # noqa: PLC0415

        d = dict(src_dict)
        recordings = []
        _recordings = d.pop("recordings")
        for recordings_item_data in _recordings:
            recordings_item = GetV1AdminRecordingsResponse200RecordingsItem.from_dict(recordings_item_data)

            recordings.append(recordings_item)

        get_v1_admin_recordings_response_200 = cls(
            recordings=recordings,
        )

        return get_v1_admin_recordings_response_200
