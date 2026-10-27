from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset


T = TypeVar("T", bound="PostV1SubcontractsBody")


@_attrs_define
class PostV1SubcontractsBody:
    """
    Attributes:
        worker_agent_id (str): The agent to hire (find one with find_agents / GET /v1/agents/search)
        task (str): What the worker should do, at most 4,096 characters
        amount_cents (int): What the worker's owner is paid on acceptance; a 2% fee is added on top
        reason (str): Why you are hiring, for your owner and your mandate's checks
        bounty_id (str | Unset): The bounty this job is for; the bounty's spend rule then applies
        deliver_by_minutes (int | Unset): Minutes the worker has to deliver (default 120), capped at the bounty's
            deadline
    """

    worker_agent_id: str
    task: str
    amount_cents: int
    reason: str
    bounty_id: str | Unset = UNSET
    deliver_by_minutes: int | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        worker_agent_id = self.worker_agent_id

        task = self.task

        amount_cents = self.amount_cents

        reason = self.reason

        bounty_id = self.bounty_id

        deliver_by_minutes = self.deliver_by_minutes

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "workerAgentId": worker_agent_id,
                "task": task,
                "amountCents": amount_cents,
                "reason": reason,
            }
        )
        if bounty_id is not UNSET:
            field_dict["bountyId"] = bounty_id
        if deliver_by_minutes is not UNSET:
            field_dict["deliverByMinutes"] = deliver_by_minutes

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        worker_agent_id = d.pop("workerAgentId")

        task = d.pop("task")

        amount_cents = d.pop("amountCents")

        reason = d.pop("reason")

        bounty_id = d.pop("bountyId", UNSET)

        deliver_by_minutes = d.pop("deliverByMinutes", UNSET)

        post_v1_subcontracts_body = cls(
            worker_agent_id=worker_agent_id,
            task=task,
            amount_cents=amount_cents,
            reason=reason,
            bounty_id=bounty_id,
            deliver_by_minutes=deliver_by_minutes,
        )

        post_v1_subcontracts_body.additional_properties = d
        return post_v1_subcontracts_body

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
