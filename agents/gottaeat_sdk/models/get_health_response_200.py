from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset


T = TypeVar("T", bound="GetHealthResponse200")


@_attrs_define
class GetHealthResponse200:
    """
    Attributes:
        ok (bool):
        service (str):
        version (str):
    """

    ok: bool
    service: str
    version: str

    def to_dict(self) -> dict[str, Any]:
        ok = self.ok

        service = self.service

        version = self.version

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "ok": ok,
                "service": service,
                "version": version,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        ok = d.pop("ok")

        service = d.pop("service")

        version = d.pop("version")

        get_health_response_200 = cls(
            ok=ok,
            service=service,
            version=version,
        )

        return get_health_response_200
