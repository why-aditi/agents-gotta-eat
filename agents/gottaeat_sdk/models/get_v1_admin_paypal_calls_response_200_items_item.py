from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_v1_admin_paypal_calls_response_200_items_item_source import (
    GetV1AdminPaypalCallsResponse200ItemsItemSource,
)
from typing import cast
import datetime


T = TypeVar("T", bound="GetV1AdminPaypalCallsResponse200ItemsItem")


@_attrs_define
class GetV1AdminPaypalCallsResponse200ItemsItem:
    """
    Attributes:
        id (int):
        method (str):
        path (str):
        status (int | None):
        debug_id (None | str):
        request_id (None | str):
        duration_ms (int):
        source (GetV1AdminPaypalCallsResponse200ItemsItemSource):
        created_at (datetime.datetime):
    """

    id: int
    method: str
    path: str
    status: int | None
    debug_id: None | str
    request_id: None | str
    duration_ms: int
    source: GetV1AdminPaypalCallsResponse200ItemsItemSource
    created_at: datetime.datetime

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        method = self.method

        path = self.path

        status: int | None
        status = self.status

        debug_id: None | str
        debug_id = self.debug_id

        request_id: None | str
        request_id = self.request_id

        duration_ms = self.duration_ms

        source = self.source.value

        created_at = self.created_at.isoformat()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "method": method,
                "path": path,
                "status": status,
                "debugId": debug_id,
                "requestId": request_id,
                "durationMs": duration_ms,
                "source": source,
                "createdAt": created_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        method = d.pop("method")

        path = d.pop("path")

        def _parse_status(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        status = _parse_status(d.pop("status"))

        def _parse_debug_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        debug_id = _parse_debug_id(d.pop("debugId"))

        def _parse_request_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        request_id = _parse_request_id(d.pop("requestId"))

        duration_ms = d.pop("durationMs")

        source = GetV1AdminPaypalCallsResponse200ItemsItemSource(d.pop("source"))

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        get_v1_admin_paypal_calls_response_200_items_item = cls(
            id=id,
            method=method,
            path=path,
            status=status,
            debug_id=debug_id,
            request_id=request_id,
            duration_ms=duration_ms,
            source=source,
            created_at=created_at,
        )

        return get_v1_admin_paypal_calls_response_200_items_item
