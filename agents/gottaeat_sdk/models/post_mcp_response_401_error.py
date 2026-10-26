from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.post_mcp_response_401_error_code import PostMcpResponse401ErrorCode
from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
    from ..models.post_mcp_response_401_error_detail import PostMcpResponse401ErrorDetail


T = TypeVar("T", bound="PostMcpResponse401Error")


@_attrs_define
class PostMcpResponse401Error:
    """
    Attributes:
        code (PostMcpResponse401ErrorCode):
        message (str):
        detail (PostMcpResponse401ErrorDetail | Unset):
    """

    code: PostMcpResponse401ErrorCode
    message: str
    detail: PostMcpResponse401ErrorDetail | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_mcp_response_401_error_detail import PostMcpResponse401ErrorDetail  # noqa: PLC0415

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
        from ..models.post_mcp_response_401_error_detail import PostMcpResponse401ErrorDetail  # noqa: PLC0415

        d = dict(src_dict)
        code = PostMcpResponse401ErrorCode(d.pop("code"))

        message = d.pop("message")

        _detail = d.pop("detail", UNSET)
        detail: PostMcpResponse401ErrorDetail | Unset
        if isinstance(_detail, Unset):
            detail = UNSET
        else:
            detail = PostMcpResponse401ErrorDetail.from_dict(_detail)

        post_mcp_response_401_error = cls(
            code=code,
            message=message,
            detail=detail,
        )

        return post_mcp_response_401_error
