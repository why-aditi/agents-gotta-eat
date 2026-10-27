from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.post_v1_admin_reconcile_paypal_response_503_error import PostV1AdminReconcilePaypalResponse503Error


T = TypeVar("T", bound="PostV1AdminReconcilePaypalResponse503")


@_attrs_define
class PostV1AdminReconcilePaypalResponse503:
    """
    Attributes:
        error (PostV1AdminReconcilePaypalResponse503Error):
    """

    error: PostV1AdminReconcilePaypalResponse503Error

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_v1_admin_reconcile_paypal_response_503_error import (
            PostV1AdminReconcilePaypalResponse503Error,
        )  # noqa: PLC0415

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
        from ..models.post_v1_admin_reconcile_paypal_response_503_error import (
            PostV1AdminReconcilePaypalResponse503Error,
        )  # noqa: PLC0415

        d = dict(src_dict)
        error = PostV1AdminReconcilePaypalResponse503Error.from_dict(d.pop("error"))

        post_v1_admin_reconcile_paypal_response_503 = cls(
            error=error,
        )

        return post_v1_admin_reconcile_paypal_response_503
