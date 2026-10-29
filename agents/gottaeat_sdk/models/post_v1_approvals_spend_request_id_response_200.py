from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.post_v1_approvals_spend_request_id_response_200_category import (
    PostV1ApprovalsSpendRequestIdResponse200Category,
)
from ..models.post_v1_approvals_spend_request_id_response_200_status import (
    PostV1ApprovalsSpendRequestIdResponse200Status,
)
from typing import cast
import datetime

if TYPE_CHECKING:
    from ..models.post_v1_approvals_spend_request_id_response_200_decisions_item import (
        PostV1ApprovalsSpendRequestIdResponse200DecisionsItem,
    )


T = TypeVar("T", bound="PostV1ApprovalsSpendRequestIdResponse200")


@_attrs_define
class PostV1ApprovalsSpendRequestIdResponse200:
    """
    Attributes:
        id (str):
        agent_id (str):
        agent_name (str):
        payee_agent_id (None | str):
        payee_agent_name (None | str):
        amount_cents (int):
        fee_cents (int):
        category (PostV1ApprovalsSpendRequestIdResponse200Category):
        reason (str):
        bounty_id (None | str):
        status (PostV1ApprovalsSpendRequestIdResponse200Status):
        expires_at (datetime.datetime | None):
        created_at (datetime.datetime):
        decided_at (datetime.datetime | None):
        decisions (list[PostV1ApprovalsSpendRequestIdResponse200DecisionsItem]):
    """

    id: str
    agent_id: str
    agent_name: str
    payee_agent_id: None | str
    payee_agent_name: None | str
    amount_cents: int
    fee_cents: int
    category: PostV1ApprovalsSpendRequestIdResponse200Category
    reason: str
    bounty_id: None | str
    status: PostV1ApprovalsSpendRequestIdResponse200Status
    expires_at: datetime.datetime | None
    created_at: datetime.datetime
    decided_at: datetime.datetime | None
    decisions: list[PostV1ApprovalsSpendRequestIdResponse200DecisionsItem]

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_v1_approvals_spend_request_id_response_200_decisions_item import (
            PostV1ApprovalsSpendRequestIdResponse200DecisionsItem,
        )  # noqa: PLC0415

        id = self.id

        agent_id = self.agent_id

        agent_name = self.agent_name

        payee_agent_id: None | str
        payee_agent_id = self.payee_agent_id

        payee_agent_name: None | str
        payee_agent_name = self.payee_agent_name

        amount_cents = self.amount_cents

        fee_cents = self.fee_cents

        category = self.category.value

        reason = self.reason

        bounty_id: None | str
        bounty_id = self.bounty_id

        status = self.status.value

        expires_at: None | str
        if isinstance(self.expires_at, datetime.datetime):
            expires_at = self.expires_at.isoformat()
        else:
            expires_at = self.expires_at

        created_at = self.created_at.isoformat()

        decided_at: None | str
        if isinstance(self.decided_at, datetime.datetime):
            decided_at = self.decided_at.isoformat()
        else:
            decided_at = self.decided_at

        decisions = []
        for decisions_item_data in self.decisions:
            decisions_item = decisions_item_data.to_dict()
            decisions.append(decisions_item)

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "agentId": agent_id,
                "agentName": agent_name,
                "payeeAgentId": payee_agent_id,
                "payeeAgentName": payee_agent_name,
                "amountCents": amount_cents,
                "feeCents": fee_cents,
                "category": category,
                "reason": reason,
                "bountyId": bounty_id,
                "status": status,
                "expiresAt": expires_at,
                "createdAt": created_at,
                "decidedAt": decided_at,
                "decisions": decisions,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_v1_approvals_spend_request_id_response_200_decisions_item import (
            PostV1ApprovalsSpendRequestIdResponse200DecisionsItem,
        )  # noqa: PLC0415

        d = dict(src_dict)
        id = d.pop("id")

        agent_id = d.pop("agentId")

        agent_name = d.pop("agentName")

        def _parse_payee_agent_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        payee_agent_id = _parse_payee_agent_id(d.pop("payeeAgentId"))

        def _parse_payee_agent_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        payee_agent_name = _parse_payee_agent_name(d.pop("payeeAgentName"))

        amount_cents = d.pop("amountCents")

        fee_cents = d.pop("feeCents")

        category = PostV1ApprovalsSpendRequestIdResponse200Category(d.pop("category"))

        reason = d.pop("reason")

        def _parse_bounty_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        bounty_id = _parse_bounty_id(d.pop("bountyId"))

        status = PostV1ApprovalsSpendRequestIdResponse200Status(d.pop("status"))

        def _parse_expires_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                expires_at_type_0 = datetime.datetime.fromisoformat(data)

                return expires_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        expires_at = _parse_expires_at(d.pop("expiresAt"))

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

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

        decisions = []
        _decisions = d.pop("decisions")
        for decisions_item_data in _decisions:
            decisions_item = PostV1ApprovalsSpendRequestIdResponse200DecisionsItem.from_dict(decisions_item_data)

            decisions.append(decisions_item)

        post_v1_approvals_spend_request_id_response_200 = cls(
            id=id,
            agent_id=agent_id,
            agent_name=agent_name,
            payee_agent_id=payee_agent_id,
            payee_agent_name=payee_agent_name,
            amount_cents=amount_cents,
            fee_cents=fee_cents,
            category=category,
            reason=reason,
            bounty_id=bounty_id,
            status=status,
            expires_at=expires_at,
            created_at=created_at,
            decided_at=decided_at,
            decisions=decisions,
        )

        return post_v1_approvals_spend_request_id_response_200
