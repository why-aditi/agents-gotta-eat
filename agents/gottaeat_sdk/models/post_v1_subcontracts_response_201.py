from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.post_v1_subcontracts_response_201_spend import PostV1SubcontractsResponse201Spend
    from ..models.post_v1_subcontracts_response_201_subcontract_type_0 import (
        PostV1SubcontractsResponse201SubcontractType0,
    )


T = TypeVar("T", bound="PostV1SubcontractsResponse201")


@_attrs_define
class PostV1SubcontractsResponse201:
    """
    Attributes:
        subcontract (None | PostV1SubcontractsResponse201SubcontractType0):
        spend (PostV1SubcontractsResponse201Spend):
    """

    subcontract: None | PostV1SubcontractsResponse201SubcontractType0
    spend: PostV1SubcontractsResponse201Spend

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_v1_subcontracts_response_201_spend import PostV1SubcontractsResponse201Spend  # noqa: PLC0415
        from ..models.post_v1_subcontracts_response_201_subcontract_type_0 import (
            PostV1SubcontractsResponse201SubcontractType0,
        )  # noqa: PLC0415

        subcontract: dict[str, Any] | None
        if isinstance(self.subcontract, PostV1SubcontractsResponse201SubcontractType0):
            subcontract = self.subcontract.to_dict()
        else:
            subcontract = self.subcontract

        spend = self.spend.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "subcontract": subcontract,
                "spend": spend,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_v1_subcontracts_response_201_spend import PostV1SubcontractsResponse201Spend  # noqa: PLC0415
        from ..models.post_v1_subcontracts_response_201_subcontract_type_0 import (
            PostV1SubcontractsResponse201SubcontractType0,
        )  # noqa: PLC0415

        d = dict(src_dict)

        def _parse_subcontract(data: object) -> None | PostV1SubcontractsResponse201SubcontractType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                subcontract_type_0 = PostV1SubcontractsResponse201SubcontractType0.from_dict(data)

                return subcontract_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | PostV1SubcontractsResponse201SubcontractType0, data)

        subcontract = _parse_subcontract(d.pop("subcontract"))

        spend = PostV1SubcontractsResponse201Spend.from_dict(d.pop("spend"))

        post_v1_subcontracts_response_201 = cls(
            subcontract=subcontract,
            spend=spend,
        )

        return post_v1_subcontracts_response_201
