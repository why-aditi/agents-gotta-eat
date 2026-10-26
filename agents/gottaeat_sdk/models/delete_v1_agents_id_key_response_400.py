from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.delete_v1_agents_id_key_response_400_error import DeleteV1AgentsIdKeyResponse400Error


T = TypeVar("T", bound="DeleteV1AgentsIdKeyResponse400")


@_attrs_define
class DeleteV1AgentsIdKeyResponse400:
    """
    Attributes:
        error (DeleteV1AgentsIdKeyResponse400Error):
    """

    error: DeleteV1AgentsIdKeyResponse400Error

    def to_dict(self) -> dict[str, Any]:
        from ..models.delete_v1_agents_id_key_response_400_error import DeleteV1AgentsIdKeyResponse400Error  # noqa: PLC0415

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
        from ..models.delete_v1_agents_id_key_response_400_error import DeleteV1AgentsIdKeyResponse400Error  # noqa: PLC0415

        d = dict(src_dict)
        error = DeleteV1AgentsIdKeyResponse400Error.from_dict(d.pop("error"))

        delete_v1_agents_id_key_response_400 = cls(
            error=error,
        )

        return delete_v1_agents_id_key_response_400
