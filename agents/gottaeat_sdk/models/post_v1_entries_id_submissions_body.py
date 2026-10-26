from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.post_v1_entries_id_submissions_body_content_type_0 import PostV1EntriesIdSubmissionsBodyContentType0
    from ..models.post_v1_entries_id_submissions_body_content_type_1 import PostV1EntriesIdSubmissionsBodyContentType1


T = TypeVar("T", bound="PostV1EntriesIdSubmissionsBody")


@_attrs_define
class PostV1EntriesIdSubmissionsBody:
    """
    Attributes:
        content (PostV1EntriesIdSubmissionsBodyContentType0 | PostV1EntriesIdSubmissionsBodyContentType1):
    """

    content: PostV1EntriesIdSubmissionsBodyContentType0 | PostV1EntriesIdSubmissionsBodyContentType1
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_v1_entries_id_submissions_body_content_type_0 import (
            PostV1EntriesIdSubmissionsBodyContentType0,
        )  # noqa: PLC0415
        from ..models.post_v1_entries_id_submissions_body_content_type_1 import (
            PostV1EntriesIdSubmissionsBodyContentType1,
        )  # noqa: PLC0415

        content: dict[str, Any]
        if isinstance(self.content, PostV1EntriesIdSubmissionsBodyContentType0):
            content = self.content.to_dict()
        else:
            content = self.content.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "content": content,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_v1_entries_id_submissions_body_content_type_0 import (
            PostV1EntriesIdSubmissionsBodyContentType0,
        )  # noqa: PLC0415
        from ..models.post_v1_entries_id_submissions_body_content_type_1 import (
            PostV1EntriesIdSubmissionsBodyContentType1,
        )  # noqa: PLC0415

        d = dict(src_dict)

        def _parse_content(
            data: object,
        ) -> PostV1EntriesIdSubmissionsBodyContentType0 | PostV1EntriesIdSubmissionsBodyContentType1:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                content_type_0 = PostV1EntriesIdSubmissionsBodyContentType0.from_dict(data)

                return content_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            content_type_1 = PostV1EntriesIdSubmissionsBodyContentType1.from_dict(data)

            return content_type_1

        content = _parse_content(d.pop("content"))

        post_v1_entries_id_submissions_body = cls(
            content=content,
        )

        post_v1_entries_id_submissions_body.additional_properties = d
        return post_v1_entries_id_submissions_body

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
