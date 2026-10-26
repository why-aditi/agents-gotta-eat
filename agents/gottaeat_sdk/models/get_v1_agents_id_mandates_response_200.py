from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.get_v1_agents_id_mandates_response_200_mandates_item import (
        GetV1AgentsIdMandatesResponse200MandatesItem,
    )


T = TypeVar("T", bound="GetV1AgentsIdMandatesResponse200")


@_attrs_define
class GetV1AgentsIdMandatesResponse200:
    """
    Attributes:
        mandates (list[GetV1AgentsIdMandatesResponse200MandatesItem]):
    """

    mandates: list[GetV1AgentsIdMandatesResponse200MandatesItem]

    def to_dict(self) -> dict[str, Any]:
        from ..models.get_v1_agents_id_mandates_response_200_mandates_item import (
            GetV1AgentsIdMandatesResponse200MandatesItem,
        )  # noqa: PLC0415

        mandates = []
        for mandates_item_data in self.mandates:
            mandates_item = mandates_item_data.to_dict()
            mandates.append(mandates_item)

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "mandates": mandates,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_v1_agents_id_mandates_response_200_mandates_item import (
            GetV1AgentsIdMandatesResponse200MandatesItem,
        )  # noqa: PLC0415

        d = dict(src_dict)
        mandates = []
        _mandates = d.pop("mandates")
        for mandates_item_data in _mandates:
            mandates_item = GetV1AgentsIdMandatesResponse200MandatesItem.from_dict(mandates_item_data)

            mandates.append(mandates_item)

        get_v1_agents_id_mandates_response_200 = cls(
            mandates=mandates,
        )

        return get_v1_agents_id_mandates_response_200
