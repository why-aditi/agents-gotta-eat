from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.get_v1_demo_status_response_200_featured_type_0 import GetV1DemoStatusResponse200FeaturedType0
    from ..models.get_v1_demo_status_response_200_live import GetV1DemoStatusResponse200Live


T = TypeVar("T", bound="GetV1DemoStatusResponse200")


@_attrs_define
class GetV1DemoStatusResponse200:
    """
    Attributes:
        featured (GetV1DemoStatusResponse200FeaturedType0 | None):
        live (GetV1DemoStatusResponse200Live):
    """

    featured: GetV1DemoStatusResponse200FeaturedType0 | None
    live: GetV1DemoStatusResponse200Live

    def to_dict(self) -> dict[str, Any]:
        from ..models.get_v1_demo_status_response_200_featured_type_0 import GetV1DemoStatusResponse200FeaturedType0  # noqa: PLC0415
        from ..models.get_v1_demo_status_response_200_live import GetV1DemoStatusResponse200Live  # noqa: PLC0415

        featured: dict[str, Any] | None
        if isinstance(self.featured, GetV1DemoStatusResponse200FeaturedType0):
            featured = self.featured.to_dict()
        else:
            featured = self.featured

        live = self.live.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "featured": featured,
                "live": live,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_v1_demo_status_response_200_featured_type_0 import GetV1DemoStatusResponse200FeaturedType0  # noqa: PLC0415
        from ..models.get_v1_demo_status_response_200_live import GetV1DemoStatusResponse200Live  # noqa: PLC0415

        d = dict(src_dict)

        def _parse_featured(data: object) -> GetV1DemoStatusResponse200FeaturedType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                featured_type_0 = GetV1DemoStatusResponse200FeaturedType0.from_dict(data)

                return featured_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(GetV1DemoStatusResponse200FeaturedType0 | None, data)

        featured = _parse_featured(d.pop("featured"))

        live = GetV1DemoStatusResponse200Live.from_dict(d.pop("live"))

        get_v1_demo_status_response_200 = cls(
            featured=featured,
            live=live,
        )

        return get_v1_demo_status_response_200
