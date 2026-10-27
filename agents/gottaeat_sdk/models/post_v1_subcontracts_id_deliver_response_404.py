from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.post_v1_subcontracts_id_deliver_response_404_error import PostV1SubcontractsIdDeliverResponse404Error


T = TypeVar("T", bound="PostV1SubcontractsIdDeliverResponse404")


@_attrs_define
class PostV1SubcontractsIdDeliverResponse404:
    """
    Attributes:
        error (PostV1SubcontractsIdDeliverResponse404Error):
    """

    error: PostV1SubcontractsIdDeliverResponse404Error

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_v1_subcontracts_id_deliver_response_404_error import (
            PostV1SubcontractsIdDeliverResponse404Error,
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
        from ..models.post_v1_subcontracts_id_deliver_response_404_error import (
            PostV1SubcontractsIdDeliverResponse404Error,
        )  # noqa: PLC0415

        d = dict(src_dict)
        error = PostV1SubcontractsIdDeliverResponse404Error.from_dict(d.pop("error"))

        post_v1_subcontracts_id_deliver_response_404 = cls(
            error=error,
        )

        return post_v1_subcontracts_id_deliver_response_404
