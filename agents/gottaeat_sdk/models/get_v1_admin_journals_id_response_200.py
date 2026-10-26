from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_v1_admin_journals_id_response_200_kind import GetV1AdminJournalsIdResponse200Kind
from typing import cast
import datetime

if TYPE_CHECKING:
    from ..models.get_v1_admin_journals_id_response_200_lines_item import GetV1AdminJournalsIdResponse200LinesItem


T = TypeVar("T", bound="GetV1AdminJournalsIdResponse200")


@_attrs_define
class GetV1AdminJournalsIdResponse200:
    """
    Attributes:
        id (str):
        kind (GetV1AdminJournalsIdResponse200Kind):
        ref_type (None | str):
        ref_id (None | str):
        idempotency_key (str):
        total_cents (int):
        created_at (datetime.datetime):
        lines (list[GetV1AdminJournalsIdResponse200LinesItem]):
    """

    id: str
    kind: GetV1AdminJournalsIdResponse200Kind
    ref_type: None | str
    ref_id: None | str
    idempotency_key: str
    total_cents: int
    created_at: datetime.datetime
    lines: list[GetV1AdminJournalsIdResponse200LinesItem]

    def to_dict(self) -> dict[str, Any]:
        from ..models.get_v1_admin_journals_id_response_200_lines_item import GetV1AdminJournalsIdResponse200LinesItem  # noqa: PLC0415

        id = self.id

        kind = self.kind.value

        ref_type: None | str
        ref_type = self.ref_type

        ref_id: None | str
        ref_id = self.ref_id

        idempotency_key = self.idempotency_key

        total_cents = self.total_cents

        created_at = self.created_at.isoformat()

        lines = []
        for lines_item_data in self.lines:
            lines_item = lines_item_data.to_dict()
            lines.append(lines_item)

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "kind": kind,
                "refType": ref_type,
                "refId": ref_id,
                "idempotencyKey": idempotency_key,
                "totalCents": total_cents,
                "createdAt": created_at,
                "lines": lines,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_v1_admin_journals_id_response_200_lines_item import GetV1AdminJournalsIdResponse200LinesItem  # noqa: PLC0415

        d = dict(src_dict)
        id = d.pop("id")

        kind = GetV1AdminJournalsIdResponse200Kind(d.pop("kind"))

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

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        lines = []
        _lines = d.pop("lines")
        for lines_item_data in _lines:
            lines_item = GetV1AdminJournalsIdResponse200LinesItem.from_dict(lines_item_data)

            lines.append(lines_item)

        get_v1_admin_journals_id_response_200 = cls(
            id=id,
            kind=kind,
            ref_type=ref_type,
            ref_id=ref_id,
            idempotency_key=idempotency_key,
            total_cents=total_cents,
            created_at=created_at,
            lines=lines,
        )

        return get_v1_admin_journals_id_response_200
