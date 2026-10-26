from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.post_v1_bounties_body_type_0_spec_schema import PostV1BountiesBodyType0SpecSchema
    from ..models.post_v1_bounties_body_type_0_spec_sources_item import PostV1BountiesBodyType0SpecSourcesItem


T = TypeVar("T", bound="PostV1BountiesBodyType0Spec")


@_attrs_define
class PostV1BountiesBodyType0Spec:
    """
    Attributes:
        instructions (str):
        schema (PostV1BountiesBodyType0SpecSchema):
        sources (list[PostV1BountiesBodyType0SpecSourcesItem]):
    """

    instructions: str
    schema: PostV1BountiesBodyType0SpecSchema
    sources: list[PostV1BountiesBodyType0SpecSourcesItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_v1_bounties_body_type_0_spec_schema import PostV1BountiesBodyType0SpecSchema  # noqa: PLC0415
        from ..models.post_v1_bounties_body_type_0_spec_sources_item import PostV1BountiesBodyType0SpecSourcesItem  # noqa: PLC0415

        instructions = self.instructions

        schema = self.schema.to_dict()

        sources = []
        for sources_item_data in self.sources:
            sources_item = sources_item_data.to_dict()
            sources.append(sources_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "instructions": instructions,
                "schema": schema,
                "sources": sources,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_v1_bounties_body_type_0_spec_schema import PostV1BountiesBodyType0SpecSchema  # noqa: PLC0415
        from ..models.post_v1_bounties_body_type_0_spec_sources_item import PostV1BountiesBodyType0SpecSourcesItem  # noqa: PLC0415

        d = dict(src_dict)
        instructions = d.pop("instructions")

        schema = PostV1BountiesBodyType0SpecSchema.from_dict(d.pop("schema"))

        sources = []
        _sources = d.pop("sources")
        for sources_item_data in _sources:
            sources_item = PostV1BountiesBodyType0SpecSourcesItem.from_dict(sources_item_data)

            sources.append(sources_item)

        post_v1_bounties_body_type_0_spec = cls(
            instructions=instructions,
            schema=schema,
            sources=sources,
        )

        post_v1_bounties_body_type_0_spec.additional_properties = d
        return post_v1_bounties_body_type_0_spec

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
