from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.post_v1_admin_recordings_id_feature_response_200_source import (
    PostV1AdminRecordingsIdFeatureResponse200Source,
)
from typing import cast
import datetime


T = TypeVar("T", bound="PostV1AdminRecordingsIdFeatureResponse200")


@_attrs_define
class PostV1AdminRecordingsIdFeatureResponse200:
    """
    Attributes:
        id (str):
        title (str):
        notes (None | str):
        started_at (datetime.datetime):
        ended_at (datetime.datetime | None):
        event_count (int):
        featured (bool):
        source (PostV1AdminRecordingsIdFeatureResponse200Source):
    """

    id: str
    title: str
    notes: None | str
    started_at: datetime.datetime
    ended_at: datetime.datetime | None
    event_count: int
    featured: bool
    source: PostV1AdminRecordingsIdFeatureResponse200Source

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        title = self.title

        notes: None | str
        notes = self.notes

        started_at = self.started_at.isoformat()

        ended_at: None | str
        if isinstance(self.ended_at, datetime.datetime):
            ended_at = self.ended_at.isoformat()
        else:
            ended_at = self.ended_at

        event_count = self.event_count

        featured = self.featured

        source = self.source.value

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "title": title,
                "notes": notes,
                "startedAt": started_at,
                "endedAt": ended_at,
                "eventCount": event_count,
                "featured": featured,
                "source": source,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        title = d.pop("title")

        def _parse_notes(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        notes = _parse_notes(d.pop("notes"))

        started_at = datetime.datetime.fromisoformat(d.pop("startedAt"))

        def _parse_ended_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                ended_at_type_0 = datetime.datetime.fromisoformat(data)

                return ended_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        ended_at = _parse_ended_at(d.pop("endedAt"))

        event_count = d.pop("eventCount")

        featured = d.pop("featured")

        source = PostV1AdminRecordingsIdFeatureResponse200Source(d.pop("source"))

        post_v1_admin_recordings_id_feature_response_200 = cls(
            id=id,
            title=title,
            notes=notes,
            started_at=started_at,
            ended_at=ended_at,
            event_count=event_count,
            featured=featured,
            source=source,
        )

        return post_v1_admin_recordings_id_feature_response_200
