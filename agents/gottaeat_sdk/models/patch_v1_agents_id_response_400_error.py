from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.patch_v1_agents_id_response_400_error_code import PatchV1AgentsIdResponse400ErrorCode
from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
    from ..models.patch_v1_agents_id_response_400_error_detail import PatchV1AgentsIdResponse400ErrorDetail


T = TypeVar("T", bound="PatchV1AgentsIdResponse400Error")


@_attrs_define
class PatchV1AgentsIdResponse400Error:
    """
    Attributes:
        code (PatchV1AgentsIdResponse400ErrorCode):
        message (str):
        detail (PatchV1AgentsIdResponse400ErrorDetail | Unset):
    """

    code: PatchV1AgentsIdResponse400ErrorCode
    message: str
    detail: PatchV1AgentsIdResponse400ErrorDetail | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        from ..models.patch_v1_agents_id_response_400_error_detail import PatchV1AgentsIdResponse400ErrorDetail  # noqa: PLC0415

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
        from ..models.patch_v1_agents_id_response_400_error_detail import PatchV1AgentsIdResponse400ErrorDetail  # noqa: PLC0415

        d = dict(src_dict)
        code = PatchV1AgentsIdResponse400ErrorCode(d.pop("code"))

        message = d.pop("message")

        _detail = d.pop("detail", UNSET)
        detail: PatchV1AgentsIdResponse400ErrorDetail | Unset
        if isinstance(_detail, Unset):
            detail = UNSET
        else:
            detail = PatchV1AgentsIdResponse400ErrorDetail.from_dict(_detail)

        patch_v1_agents_id_response_400_error = cls(
            code=code,
            message=message,
            detail=detail,
        )

        return patch_v1_agents_id_response_400_error
