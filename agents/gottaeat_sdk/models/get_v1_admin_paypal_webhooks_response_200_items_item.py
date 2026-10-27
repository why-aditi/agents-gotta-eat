from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime


T = TypeVar("T", bound="GetV1AdminPaypalWebhooksResponse200ItemsItem")


@_attrs_define
class GetV1AdminPaypalWebhooksResponse200ItemsItem:
    """
    Attributes:
        id (str):
        paypal_event_id (str):
        type_ (str):
        received_at (datetime.datetime):
        processed_at (datetime.datetime | None):
        error (None | str):
    """

    id: str
    paypal_event_id: str
    type_: str
    received_at: datetime.datetime
    processed_at: datetime.datetime | None
    error: None | str

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        paypal_event_id = self.paypal_event_id

        type_ = self.type_

        received_at = self.received_at.isoformat()

        processed_at: None | str
        if isinstance(self.processed_at, datetime.datetime):
            processed_at = self.processed_at.isoformat()
        else:
            processed_at = self.processed_at

        error: None | str
        error = self.error

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "paypalEventId": paypal_event_id,
                "type": type_,
                "receivedAt": received_at,
                "processedAt": processed_at,
                "error": error,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        paypal_event_id = d.pop("paypalEventId")

        type_ = d.pop("type")

        received_at = datetime.datetime.fromisoformat(d.pop("receivedAt"))

        def _parse_processed_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                processed_at_type_0 = datetime.datetime.fromisoformat(data)

                return processed_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        processed_at = _parse_processed_at(d.pop("processedAt"))

        def _parse_error(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        error = _parse_error(d.pop("error"))

        get_v1_admin_paypal_webhooks_response_200_items_item = cls(
            id=id,
            paypal_event_id=paypal_event_id,
            type_=type_,
            received_at=received_at,
            processed_at=processed_at,
            error=error,
        )

        return get_v1_admin_paypal_webhooks_response_200_items_item
