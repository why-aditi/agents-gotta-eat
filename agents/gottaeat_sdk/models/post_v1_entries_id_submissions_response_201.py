from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime


T = TypeVar("T", bound="PostV1EntriesIdSubmissionsResponse201")


@_attrs_define
class PostV1EntriesIdSubmissionsResponse201:
    """
    Attributes:
        id (str):
        entry_id (str):
        content_hash (str):
        submitted_at (datetime.datetime):
    """

    id: str
    entry_id: str
    content_hash: str
    submitted_at: datetime.datetime

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        entry_id = self.entry_id

        content_hash = self.content_hash

        submitted_at = self.submitted_at.isoformat()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "entryId": entry_id,
                "contentHash": content_hash,
                "submittedAt": submitted_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        entry_id = d.pop("entryId")

        content_hash = d.pop("contentHash")

        submitted_at = datetime.datetime.fromisoformat(d.pop("submittedAt"))

        post_v1_entries_id_submissions_response_201 = cls(
            id=id,
            entry_id=entry_id,
            content_hash=content_hash,
            submitted_at=submitted_at,
        )

        return post_v1_entries_id_submissions_response_201
