from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.post_v1_bounties_id_cancel_response_404_error_code import PostV1BountiesIdCancelResponse404ErrorCode
from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
    from ..models.post_v1_bounties_id_cancel_response_404_error_detail import (
        PostV1BountiesIdCancelResponse404ErrorDetail,
    )


T = TypeVar("T", bound="PostV1BountiesIdCancelResponse404Error")


@_attrs_define
class PostV1BountiesIdCancelResponse404Error:
    """
    Attributes:
        code (PostV1BountiesIdCancelResponse404ErrorCode):
        message (str):
        detail (PostV1BountiesIdCancelResponse404ErrorDetail | Unset):
    """

    code: PostV1BountiesIdCancelResponse404ErrorCode
    message: str
    detail: PostV1BountiesIdCancelResponse404ErrorDetail | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_v1_bounties_id_cancel_response_404_error_detail import (
            PostV1BountiesIdCancelResponse404ErrorDetail,
        )  # noqa: PLC0415

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
        from ..models.post_v1_bounties_id_cancel_response_404_error_detail import (
            PostV1BountiesIdCancelResponse404ErrorDetail,
        )  # noqa: PLC0415

        d = dict(src_dict)
        code = PostV1BountiesIdCancelResponse404ErrorCode(d.pop("code"))

        message = d.pop("message")

        _detail = d.pop("detail", UNSET)
        detail: PostV1BountiesIdCancelResponse404ErrorDetail | Unset
        if isinstance(_detail, Unset):
            detail = UNSET
        else:
            detail = PostV1BountiesIdCancelResponse404ErrorDetail.from_dict(_detail)

        post_v1_bounties_id_cancel_response_404_error = cls(
            code=code,
            message=message,
            detail=detail,
        )

        return post_v1_bounties_id_cancel_response_404_error
