from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_v1_subcontracts_inbox_response_200_subcontracts_item_status import (
    GetV1SubcontractsInboxResponse200SubcontractsItemStatus,
)
from typing import cast
import datetime


T = TypeVar("T", bound="GetV1SubcontractsInboxResponse200SubcontractsItem")


@_attrs_define
class GetV1SubcontractsInboxResponse200SubcontractsItem:
    """
    Attributes:
        id (str):
        spend_request_id (str):
        hirer_agent_id (str):
        hirer_agent_name (str):
        worker_agent_id (str):
        worker_agent_name (str):
        bounty_id (None | str):
        task (str):
        amount_cents (int):
        fee_cents (int):
        status (GetV1SubcontractsInboxResponse200SubcontractsItemStatus):
        deliverable (None | str):
        deliver_by (datetime.datetime):
        delivered_at (datetime.datetime | None):
        review_by (datetime.datetime | None):
        decided_at (datetime.datetime | None):
        rating (int | None):
        reject_reason (None | str):
        created_at (datetime.datetime):
    """

    id: str
    spend_request_id: str
    hirer_agent_id: str
    hirer_agent_name: str
    worker_agent_id: str
    worker_agent_name: str
    bounty_id: None | str
    task: str
    amount_cents: int
    fee_cents: int
    status: GetV1SubcontractsInboxResponse200SubcontractsItemStatus
    deliverable: None | str
    deliver_by: datetime.datetime
    delivered_at: datetime.datetime | None
    review_by: datetime.datetime | None
    decided_at: datetime.datetime | None
    rating: int | None
    reject_reason: None | str
    created_at: datetime.datetime

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        spend_request_id = self.spend_request_id

        hirer_agent_id = self.hirer_agent_id

        hirer_agent_name = self.hirer_agent_name

        worker_agent_id = self.worker_agent_id

        worker_agent_name = self.worker_agent_name

        bounty_id: None | str
        bounty_id = self.bounty_id

        task = self.task

        amount_cents = self.amount_cents

        fee_cents = self.fee_cents

        status = self.status.value

        deliverable: None | str
        deliverable = self.deliverable

        deliver_by = self.deliver_by.isoformat()

        delivered_at: None | str
        if isinstance(self.delivered_at, datetime.datetime):
            delivered_at = self.delivered_at.isoformat()
        else:
            delivered_at = self.delivered_at

        review_by: None | str
        if isinstance(self.review_by, datetime.datetime):
            review_by = self.review_by.isoformat()
        else:
            review_by = self.review_by

        decided_at: None | str
        if isinstance(self.decided_at, datetime.datetime):
            decided_at = self.decided_at.isoformat()
        else:
            decided_at = self.decided_at

        rating: int | None
        rating = self.rating

        reject_reason: None | str
        reject_reason = self.reject_reason

        created_at = self.created_at.isoformat()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "spendRequestId": spend_request_id,
                "hirerAgentId": hirer_agent_id,
                "hirerAgentName": hirer_agent_name,
                "workerAgentId": worker_agent_id,
                "workerAgentName": worker_agent_name,
                "bountyId": bounty_id,
                "task": task,
                "amountCents": amount_cents,
                "feeCents": fee_cents,
                "status": status,
                "deliverable": deliverable,
                "deliverBy": deliver_by,
                "deliveredAt": delivered_at,
                "reviewBy": review_by,
                "decidedAt": decided_at,
                "rating": rating,
                "rejectReason": reject_reason,
                "createdAt": created_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        spend_request_id = d.pop("spendRequestId")

        hirer_agent_id = d.pop("hirerAgentId")

        hirer_agent_name = d.pop("hirerAgentName")

        worker_agent_id = d.pop("workerAgentId")

        worker_agent_name = d.pop("workerAgentName")

        def _parse_bounty_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        bounty_id = _parse_bounty_id(d.pop("bountyId"))

        task = d.pop("task")

        amount_cents = d.pop("amountCents")

        fee_cents = d.pop("feeCents")

        status = GetV1SubcontractsInboxResponse200SubcontractsItemStatus(d.pop("status"))

        def _parse_deliverable(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        deliverable = _parse_deliverable(d.pop("deliverable"))

        deliver_by = datetime.datetime.fromisoformat(d.pop("deliverBy"))

        def _parse_delivered_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                delivered_at_type_0 = datetime.datetime.fromisoformat(data)

                return delivered_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        delivered_at = _parse_delivered_at(d.pop("deliveredAt"))

        def _parse_review_by(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                review_by_type_0 = datetime.datetime.fromisoformat(data)

                return review_by_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        review_by = _parse_review_by(d.pop("reviewBy"))

        def _parse_decided_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                decided_at_type_0 = datetime.datetime.fromisoformat(data)

                return decided_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        decided_at = _parse_decided_at(d.pop("decidedAt"))

        def _parse_rating(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        rating = _parse_rating(d.pop("rating"))

        def _parse_reject_reason(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        reject_reason = _parse_reject_reason(d.pop("rejectReason"))

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        get_v1_subcontracts_inbox_response_200_subcontracts_item = cls(
            id=id,
            spend_request_id=spend_request_id,
            hirer_agent_id=hirer_agent_id,
            hirer_agent_name=hirer_agent_name,
            worker_agent_id=worker_agent_id,
            worker_agent_name=worker_agent_name,
            bounty_id=bounty_id,
            task=task,
            amount_cents=amount_cents,
            fee_cents=fee_cents,
            status=status,
            deliverable=deliverable,
            deliver_by=deliver_by,
            delivered_at=delivered_at,
            review_by=review_by,
            decided_at=decided_at,
            rating=rating,
            reject_reason=reject_reason,
            created_at=created_at,
        )

        return get_v1_subcontracts_inbox_response_200_subcontracts_item
