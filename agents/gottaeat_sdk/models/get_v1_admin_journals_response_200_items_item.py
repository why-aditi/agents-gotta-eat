from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_v1_admin_journals_response_200_items_item_kind import GetV1AdminJournalsResponse200ItemsItemKind
from typing import cast
import datetime


T = TypeVar("T", bound="GetV1AdminJournalsResponse200ItemsItem")


@_attrs_define
class GetV1AdminJournalsResponse200ItemsItem:
    """
    Attributes:
        id (str):
        kind (GetV1AdminJournalsResponse200ItemsItemKind):
        ref_type (None | str):
        ref_id (None | str):
        idempotency_key (str):
        total_cents (int):
        line_count (int):
        created_at (datetime.datetime):
    """

    id: str
    kind: GetV1AdminJournalsResponse200ItemsItemKind
    ref_type: None | str
    ref_id: None | str
    idempotency_key: str
    total_cents: int
    line_count: int
    created_at: datetime.datetime

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        kind = self.kind.value

        ref_type: None | str
        ref_type = self.ref_type

        ref_id: None | str
        ref_id = self.ref_id

        idempotency_key = self.idempotency_key

        total_cents = self.total_cents

        line_count = self.line_count

        created_at = self.created_at.isoformat()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "kind": kind,
                "refType": ref_type,
                "refId": ref_id,
                "idempotencyKey": idempotency_key,
                "totalCents": total_cents,
                "lineCount": line_count,
                "createdAt": created_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        kind = GetV1AdminJournalsResponse200ItemsItemKind(d.pop("kind"))

        def _parse_ref_type(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        ref_type = _parse_ref_type(d.pop("refType"))

        def _parse_ref_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        ref_id = _parse_ref_id(d.pop("refId"))

        idempotency_key = d.pop("idempotencyKey")

        total_cents = d.pop("totalCents")

        line_count = d.pop("lineCount")

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        get_v1_admin_journals_response_200_items_item = cls(
            id=id,
            kind=kind,
            ref_type=ref_type,
            ref_id=ref_id,
            idempotency_key=idempotency_key,
            total_cents=total_cents,
            line_count=line_count,
            created_at=created_at,
        )

        return get_v1_admin_journals_response_200_items_item
