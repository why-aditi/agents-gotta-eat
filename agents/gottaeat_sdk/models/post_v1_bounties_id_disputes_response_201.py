from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.post_v1_bounties_id_disputes_response_201_status import PostV1BountiesIdDisputesResponse201Status
from typing import cast
import datetime


T = TypeVar("T", bound="PostV1BountiesIdDisputesResponse201")


@_attrs_define
class PostV1BountiesIdDisputesResponse201:
    """
    Attributes:
        id (str):
        bounty_id (str):
        bounty_title (str):
        poster_id (str):
        reason (str):
        status (PostV1BountiesIdDisputesResponse201Status):
        opened_at (datetime.datetime):
        resolved_at (datetime.datetime | None):
        note (None | str):
        refund_id (None | str):
        reward_cents (int):
    """

    id: str
    bounty_id: str
    bounty_title: str
    poster_id: str
    reason: str
    status: PostV1BountiesIdDisputesResponse201Status
    opened_at: datetime.datetime
    resolved_at: datetime.datetime | None
    note: None | str
    refund_id: None | str
    reward_cents: int

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        bounty_id = self.bounty_id

        bounty_title = self.bounty_title

        poster_id = self.poster_id

        reason = self.reason

        status = self.status.value

        opened_at = self.opened_at.isoformat()

        resolved_at: None | str
        if isinstance(self.resolved_at, datetime.datetime):
            resolved_at = self.resolved_at.isoformat()
        else:
            resolved_at = self.resolved_at

        note: None | str
        note = self.note

        refund_id: None | str
        refund_id = self.refund_id

        reward_cents = self.reward_cents

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "bountyId": bounty_id,
                "bountyTitle": bounty_title,
                "posterId": poster_id,
                "reason": reason,
                "status": status,
                "openedAt": opened_at,
                "resolvedAt": resolved_at,
                "note": note,
                "refundId": refund_id,
                "rewardCents": reward_cents,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        bounty_id = d.pop("bountyId")

        bounty_title = d.pop("bountyTitle")

        poster_id = d.pop("posterId")

        reason = d.pop("reason")

        status = PostV1BountiesIdDisputesResponse201Status(d.pop("status"))

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

        def _parse_refund_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        refund_id = _parse_refund_id(d.pop("refundId"))

        reward_cents = d.pop("rewardCents")

        post_v1_bounties_id_disputes_response_201 = cls(
            id=id,
            bounty_id=bounty_id,
            bounty_title=bounty_title,
            poster_id=poster_id,
            reason=reason,
            status=status,
            opened_at=opened_at,
            resolved_at=resolved_at,
            note=note,
            refund_id=refund_id,
            reward_cents=reward_cents,
        )

        return post_v1_bounties_id_disputes_response_201
