from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.put_v1_wallet_payout_email_response_401_error_code import PutV1WalletPayoutEmailResponse401ErrorCode
from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
    from ..models.put_v1_wallet_payout_email_response_401_error_detail import (
        PutV1WalletPayoutEmailResponse401ErrorDetail,
    )


T = TypeVar("T", bound="PutV1WalletPayoutEmailResponse401Error")


@_attrs_define
class PutV1WalletPayoutEmailResponse401Error:
    """
    Attributes:
        code (PutV1WalletPayoutEmailResponse401ErrorCode):
        message (str):
        detail (PutV1WalletPayoutEmailResponse401ErrorDetail | Unset):
    """

    code: PutV1WalletPayoutEmailResponse401ErrorCode
    message: str
    detail: PutV1WalletPayoutEmailResponse401ErrorDetail | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        from ..models.put_v1_wallet_payout_email_response_401_error_detail import (
            PutV1WalletPayoutEmailResponse401ErrorDetail,
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
        from ..models.put_v1_wallet_payout_email_response_401_error_detail import (
            PutV1WalletPayoutEmailResponse401ErrorDetail,
        )  # noqa: PLC0415

        d = dict(src_dict)
        code = PutV1WalletPayoutEmailResponse401ErrorCode(d.pop("code"))

        message = d.pop("message")

        _detail = d.pop("detail", UNSET)
        detail: PutV1WalletPayoutEmailResponse401ErrorDetail | Unset
        if isinstance(_detail, Unset):
            detail = UNSET
        else:
            detail = PutV1WalletPayoutEmailResponse401ErrorDetail.from_dict(_detail)

        put_v1_wallet_payout_email_response_401_error = cls(
            code=code,
            message=message,
            detail=detail,
        )

        return put_v1_wallet_payout_email_response_401_error
