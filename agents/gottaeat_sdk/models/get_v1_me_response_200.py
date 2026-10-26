from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast


T = TypeVar("T", bound="GetV1MeResponse200")


@_attrs_define
class GetV1MeResponse200:
    """
    Attributes:
        id (str):
        email (str):
        name (None | str):
        roles (list[str]):
    """

    id: str
    email: str
    name: None | str
    roles: list[str]

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        email = self.email

        name: None | str
        name = self.name

        roles = self.roles

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "email": email,
                "name": name,
                "roles": roles,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        email = d.pop("email")

        def _parse_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        name = _parse_name(d.pop("name"))

        roles = cast(list[str], d.pop("roles"))

        get_v1_me_response_200 = cls(
            id=id,
            email=email,
            name=name,
            roles=roles,
        )

        return get_v1_me_response_200
