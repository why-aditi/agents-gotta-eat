from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_v1_bounties_id_results_response_200_dispute_type_0_status import (
    GetV1BountiesIdResultsResponse200DisputeType0Status,
)
from typing import cast
import datetime


T = TypeVar("T", bound="GetV1BountiesIdResultsResponse200DisputeType0")


@_attrs_define
class GetV1BountiesIdResultsResponse200DisputeType0:
    """
    Attributes:
        id (str):
        status (GetV1BountiesIdResultsResponse200DisputeType0Status):
        reason (str):
        opened_at (datetime.datetime):
        resolved_at (datetime.datetime | None):
        note (None | str):
    """

    id: str
    status: GetV1BountiesIdResultsResponse200DisputeType0Status
    reason: str
    opened_at: datetime.datetime
    resolved_at: datetime.datetime | None
    note: None | str

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        status = self.status.value

        reason = self.reason

        opened_at = self.opened_at.isoformat()

        resolved_at: None | str
        if isinstance(self.resolved_at, datetime.datetime):
            resolved_at = self.resolved_at.isoformat()
        else:
            resolved_at = self.resolved_at

        note: None | str
        note = self.note

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "status": status,
                "reason": reason,
                "openedAt": opened_at,
                "resolvedAt": resolved_at,
                "note": note,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        status = GetV1BountiesIdResultsResponse200DisputeType0Status(d.pop("status"))

        reason = d.pop("reason")

        opened_at = datetime.datetime.fromisoformat(d.pop("openedAt"))

        def _parse_resolved_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                resolved_at_type_0 = datetime.datetime.fromisoformat(data)

                return resolved_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        resolved_at = _parse_resolved_at(d.pop("resolvedAt"))

        def _parse_note(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        note = _parse_note(d.pop("note"))

        get_v1_bounties_id_results_response_200_dispute_type_0 = cls(
            id=id,
            status=status,
            reason=reason,
            opened_at=opened_at,
            resolved_at=resolved_at,
            note=note,
        )

        return get_v1_bounties_id_results_response_200_dispute_type_0
