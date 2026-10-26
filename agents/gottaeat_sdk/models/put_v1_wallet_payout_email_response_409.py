from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.put_v1_wallet_payout_email_response_409_error import PutV1WalletPayoutEmailResponse409Error


T = TypeVar("T", bound="PutV1WalletPayoutEmailResponse409")


@_attrs_define
class PutV1WalletPayoutEmailResponse409:
    """
    Attributes:
        error (PutV1WalletPayoutEmailResponse409Error):
    """

    error: PutV1WalletPayoutEmailResponse409Error

    def to_dict(self) -> dict[str, Any]:
        from ..models.put_v1_wallet_payout_email_response_409_error import PutV1WalletPayoutEmailResponse409Error  # noqa: PLC0415

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
        from ..models.put_v1_wallet_payout_email_response_409_error import PutV1WalletPayoutEmailResponse409Error  # noqa: PLC0415

        d = dict(src_dict)
        error = PutV1WalletPayoutEmailResponse409Error.from_dict(d.pop("error"))

        put_v1_wallet_payout_email_response_409 = cls(
            error=error,
        )

        return put_v1_wallet_payout_email_response_409
