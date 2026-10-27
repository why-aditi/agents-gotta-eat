from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.post_v1_admin_reconcile_paypal_response_200_lines_item_status import (
    PostV1AdminReconcilePaypalResponse200LinesItemStatus,
)
from typing import cast
import datetime


T = TypeVar("T", bound="PostV1AdminReconcilePaypalResponse200LinesItem")


@_attrs_define
class PostV1AdminReconcilePaypalResponse200LinesItem:
    """
    Attributes:
        status (PostV1AdminReconcilePaypalResponse200LinesItemStatus):
        paypal_id (str):
        ledger_cents (int | None):
        paypal_cents (int | None):
        journal_ids (list[str]):
        refs (list[str]):
        event_code (None | str):
        at (datetime.datetime | None):
        detail (str):
    """

    status: PostV1AdminReconcilePaypalResponse200LinesItemStatus
    paypal_id: str
    ledger_cents: int | None
    paypal_cents: int | None
    journal_ids: list[str]
    refs: list[str]
    event_code: None | str
    at: datetime.datetime | None
    detail: str

    def to_dict(self) -> dict[str, Any]:
        status = self.status.value

        paypal_id = self.paypal_id

        ledger_cents: int | None
        ledger_cents = self.ledger_cents

        paypal_cents: int | None
        paypal_cents = self.paypal_cents

        journal_ids = self.journal_ids

        refs = self.refs

        event_code: None | str
        event_code = self.event_code

        at: None | str
        if isinstance(self.at, datetime.datetime):
            at = self.at.isoformat()
        else:
            at = self.at

        detail = self.detail

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "status": status,
                "paypalId": paypal_id,
                "ledgerCents": ledger_cents,
                "paypalCents": paypal_cents,
                "journalIds": journal_ids,
                "refs": refs,
                "eventCode": event_code,
                "at": at,
                "detail": detail,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        status = PostV1AdminReconcilePaypalResponse200LinesItemStatus(d.pop("status"))

        paypal_id = d.pop("paypalId")

        def _parse_ledger_cents(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        ledger_cents = _parse_ledger_cents(d.pop("ledgerCents"))

        def _parse_paypal_cents(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        paypal_cents = _parse_paypal_cents(d.pop("paypalCents"))

        journal_ids = cast(list[str], d.pop("journalIds"))

        refs = cast(list[str], d.pop("refs"))

        def _parse_event_code(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        event_code = _parse_event_code(d.pop("eventCode"))

        def _parse_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                at_type_0 = datetime.datetime.fromisoformat(data)

                return at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        at = _parse_at(d.pop("at"))

        detail = d.pop("detail")

        post_v1_admin_reconcile_paypal_response_200_lines_item = cls(
            status=status,
            paypal_id=paypal_id,
            ledger_cents=ledger_cents,
            paypal_cents=paypal_cents,
            journal_ids=journal_ids,
            refs=refs,
            event_code=event_code,
            at=at,
            detail=detail,
        )

        return post_v1_admin_reconcile_paypal_response_200_lines_item
