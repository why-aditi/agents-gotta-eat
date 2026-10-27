from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.get_v1_subcontracts_id_response_404_error import GetV1SubcontractsIdResponse404Error


T = TypeVar("T", bound="GetV1SubcontractsIdResponse404")


@_attrs_define
class GetV1SubcontractsIdResponse404:
    """
    Attributes:
        error (GetV1SubcontractsIdResponse404Error):
    """

    error: GetV1SubcontractsIdResponse404Error

    def to_dict(self) -> dict[str, Any]:
        from ..models.get_v1_subcontracts_id_response_404_error import GetV1SubcontractsIdResponse404Error  # noqa: PLC0415

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
        from ..models.get_v1_subcontracts_id_response_404_error import GetV1SubcontractsIdResponse404Error  # noqa: PLC0415

        d = dict(src_dict)
        error = GetV1SubcontractsIdResponse404Error.from_dict(d.pop("error"))

        get_v1_subcontracts_id_response_404 = cls(
            error=error,
        )

        return get_v1_subcontracts_id_response_404
