from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_mcp_response_405_error_code import GetMcpResponse405ErrorCode
from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
    from ..models.get_mcp_response_405_error_detail import GetMcpResponse405ErrorDetail


T = TypeVar("T", bound="GetMcpResponse405Error")


@_attrs_define
class GetMcpResponse405Error:
    """
    Attributes:
        code (GetMcpResponse405ErrorCode):
        message (str):
        detail (GetMcpResponse405ErrorDetail | Unset):
    """

    code: GetMcpResponse405ErrorCode
    message: str
    detail: GetMcpResponse405ErrorDetail | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        from ..models.get_mcp_response_405_error_detail import GetMcpResponse405ErrorDetail  # noqa: PLC0415

        code = self.code.value

        message = self.message

        detail: dict[str, Any] | Unset = UNSET
        if not isinstance(self.detail, Unset):
            detail = self.detail.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "code": code,
                "message": message,
            }
        )
        if detail is not UNSET:
            field_dict["detail"] = detail

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_mcp_response_405_error_detail import GetMcpResponse405ErrorDetail  # noqa: PLC0415

        d = dict(src_dict)
        code = GetMcpResponse405ErrorCode(d.pop("code"))

        message = d.pop("message")

        _detail = d.pop("detail", UNSET)
        detail: GetMcpResponse405ErrorDetail | Unset
        if isinstance(_detail, Unset):
            detail = UNSET
        else:
            detail = GetMcpResponse405ErrorDetail.from_dict(_detail)

        get_mcp_response_405_error = cls(
            code=code,
            message=message,
            detail=detail,
        )

        return get_mcp_response_405_error
