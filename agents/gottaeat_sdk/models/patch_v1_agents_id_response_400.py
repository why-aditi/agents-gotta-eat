from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.patch_v1_agents_id_response_400_error import PatchV1AgentsIdResponse400Error


T = TypeVar("T", bound="PatchV1AgentsIdResponse400")


@_attrs_define
class PatchV1AgentsIdResponse400:
    """
    Attributes:
        error (PatchV1AgentsIdResponse400Error):
    """

    error: PatchV1AgentsIdResponse400Error

    def to_dict(self) -> dict[str, Any]:
        from ..models.patch_v1_agents_id_response_400_error import PatchV1AgentsIdResponse400Error  # noqa: PLC0415

        error = self.error.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "error": error,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.patch_v1_agents_id_response_400_error import PatchV1AgentsIdResponse400Error  # noqa: PLC0415

        d = dict(src_dict)
        error = PatchV1AgentsIdResponse400Error.from_dict(d.pop("error"))

        patch_v1_agents_id_response_400 = cls(
            error=error,
        )

        return patch_v1_agents_id_response_400
