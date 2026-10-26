from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast


T = TypeVar("T", bound="PutV1WalletPayoutEmailResponse200")


@_attrs_define
class PutV1WalletPayoutEmailResponse200:
    """
    Attributes:
        email (None | str):
    """

    email: None | str

    def to_dict(self) -> dict[str, Any]:
        email: None | str
        email = self.email

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "email": email,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)

        def _parse_email(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        email = _parse_email(d.pop("email"))

        put_v1_wallet_payout_email_response_200 = cls(
            email=email,
        )

        return put_v1_wallet_payout_email_response_200
