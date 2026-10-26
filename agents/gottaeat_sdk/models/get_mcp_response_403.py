from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.get_mcp_response_403_error import GetMcpResponse403Error


T = TypeVar("T", bound="GetMcpResponse403")


@_attrs_define
class GetMcpResponse403:
    """
    Attributes:
        error (GetMcpResponse403Error):
    """

    error: GetMcpResponse403Error

    def to_dict(self) -> dict[str, Any]:
        from ..models.get_mcp_response_403_error import GetMcpResponse403Error  # noqa: PLC0415

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
        from ..models.get_mcp_response_403_error import GetMcpResponse403Error  # noqa: PLC0415

        d = dict(src_dict)
        error = GetMcpResponse403Error.from_dict(d.pop("error"))

        get_mcp_response_403 = cls(
            error=error,
        )

        return get_mcp_response_403
