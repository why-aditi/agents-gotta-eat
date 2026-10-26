from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.post_v1_bounties_id_cancel_response_200_status import PostV1BountiesIdCancelResponse200Status
from ..models.post_v1_bounties_id_cancel_response_200_task_type import PostV1BountiesIdCancelResponse200TaskType
from typing import cast
import datetime

if TYPE_CHECKING:
    from ..models.post_v1_bounties_id_cancel_response_200_spec import PostV1BountiesIdCancelResponse200Spec


T = TypeVar("T", bound="PostV1BountiesIdCancelResponse200")


@_attrs_define
class PostV1BountiesIdCancelResponse200:
    """
    Attributes:
        id (str):
        poster_id (str):
        task_type (PostV1BountiesIdCancelResponse200TaskType):
        title (str):
        spec (PostV1BountiesIdCancelResponse200Spec):
        reward_cents (int):
        fee_cents (int):
        spend_rule_pct (int):
        pass_threshold (int):
        deadline_at (datetime.datetime):
        status (PostV1BountiesIdCancelResponse200Status):
        opened_at (datetime.datetime | None):
        entry_count (int):
        created_at (datetime.datetime):
    """

    id: str
    poster_id: str
    task_type: PostV1BountiesIdCancelResponse200TaskType
    title: str
    spec: PostV1BountiesIdCancelResponse200Spec
    reward_cents: int
    fee_cents: int
    spend_rule_pct: int
    pass_threshold: int
    deadline_at: datetime.datetime
    status: PostV1BountiesIdCancelResponse200Status
    opened_at: datetime.datetime | None
    entry_count: int
    created_at: datetime.datetime

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_v1_bounties_id_cancel_response_200_spec import PostV1BountiesIdCancelResponse200Spec  # noqa: PLC0415

        id = self.id

        poster_id = self.poster_id

        task_type = self.task_type.value

        title = self.title

        spec = self.spec.to_dict()

        reward_cents = self.reward_cents

        fee_cents = self.fee_cents

        spend_rule_pct = self.spend_rule_pct

        pass_threshold = self.pass_threshold

        deadline_at = self.deadline_at.isoformat()

        status = self.status.value

        opened_at: None | str
        if isinstance(self.opened_at, datetime.datetime):
            opened_at = self.opened_at.isoformat()
        else:
            opened_at = self.opened_at

        entry_count = self.entry_count

        created_at = self.created_at.isoformat()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "posterId": poster_id,
                "taskType": task_type,
                "title": title,
                "spec": spec,
                "rewardCents": reward_cents,
                "feeCents": fee_cents,
                "spendRulePct": spend_rule_pct,
                "passThreshold": pass_threshold,
                "deadlineAt": deadline_at,
                "status": status,
                "openedAt": opened_at,
                "entryCount": entry_count,
                "createdAt": created_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_v1_bounties_id_cancel_response_200_spec import PostV1BountiesIdCancelResponse200Spec  # noqa: PLC0415

        d = dict(src_dict)
        id = d.pop("id")

        poster_id = d.pop("posterId")

        task_type = PostV1BountiesIdCancelResponse200TaskType(d.pop("taskType"))

        title = d.pop("title")

        spec = PostV1BountiesIdCancelResponse200Spec.from_dict(d.pop("spec"))

        reward_cents = d.pop("rewardCents")

        fee_cents = d.pop("feeCents")

        spend_rule_pct = d.pop("spendRulePct")

        pass_threshold = d.pop("passThreshold")

        deadline_at = datetime.datetime.fromisoformat(d.pop("deadlineAt"))

        status = PostV1BountiesIdCancelResponse200Status(d.pop("status"))

        def _parse_opened_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                opened_at_type_0 = datetime.datetime.fromisoformat(data)

                return opened_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        opened_at = _parse_opened_at(d.pop("openedAt"))

        entry_count = d.pop("entryCount")

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        post_v1_bounties_id_cancel_response_200 = cls(
            id=id,
            poster_id=poster_id,
            task_type=task_type,
            title=title,
            spec=spec,
            reward_cents=reward_cents,
            fee_cents=fee_cents,
            spend_rule_pct=spend_rule_pct,
            pass_threshold=pass_threshold,
            deadline_at=deadline_at,
            status=status,
            opened_at=opened_at,
            entry_count=entry_count,
            created_at=created_at,
        )

        return post_v1_bounties_id_cancel_response_200
