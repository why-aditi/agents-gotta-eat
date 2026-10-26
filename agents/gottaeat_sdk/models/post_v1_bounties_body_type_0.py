from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.post_v1_bounties_body_type_0_task_type import PostV1BountiesBodyType0TaskType
from ..types import UNSET, Unset
from typing import cast
import datetime

if TYPE_CHECKING:
    from ..models.post_v1_bounties_body_type_0_hidden import PostV1BountiesBodyType0Hidden
    from ..models.post_v1_bounties_body_type_0_spec import PostV1BountiesBodyType0Spec


T = TypeVar("T", bound="PostV1BountiesBodyType0")


@_attrs_define
class PostV1BountiesBodyType0:
    """
    Attributes:
        title (str):
        reward_cents (int):
        deadline_at (datetime.datetime):
        spend_rule_pct (int):
        task_type (PostV1BountiesBodyType0TaskType):
        spec (PostV1BountiesBodyType0Spec):
        hidden (PostV1BountiesBodyType0Hidden):
        pass_threshold (int | Unset):  Default: 60.
    """

    title: str
    reward_cents: int
    deadline_at: datetime.datetime
    spend_rule_pct: int
    task_type: PostV1BountiesBodyType0TaskType
    spec: PostV1BountiesBodyType0Spec
    hidden: PostV1BountiesBodyType0Hidden
    pass_threshold: int | Unset = 60
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_v1_bounties_body_type_0_hidden import PostV1BountiesBodyType0Hidden  # noqa: PLC0415
        from ..models.post_v1_bounties_body_type_0_spec import PostV1BountiesBodyType0Spec  # noqa: PLC0415

        title = self.title

        reward_cents = self.reward_cents

        deadline_at = self.deadline_at.isoformat()

        spend_rule_pct = self.spend_rule_pct

        task_type = self.task_type.value

        spec = self.spec.to_dict()

        hidden = self.hidden.to_dict()

        pass_threshold = self.pass_threshold

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "title": title,
                "rewardCents": reward_cents,
                "deadlineAt": deadline_at,
                "spendRulePct": spend_rule_pct,
                "taskType": task_type,
                "spec": spec,
                "hidden": hidden,
            }
        )
        if pass_threshold is not UNSET:
            field_dict["passThreshold"] = pass_threshold

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_v1_bounties_body_type_0_hidden import PostV1BountiesBodyType0Hidden  # noqa: PLC0415
        from ..models.post_v1_bounties_body_type_0_spec import PostV1BountiesBodyType0Spec  # noqa: PLC0415

        d = dict(src_dict)
        title = d.pop("title")

        reward_cents = d.pop("rewardCents")

        deadline_at = datetime.datetime.fromisoformat(d.pop("deadlineAt"))

        spend_rule_pct = d.pop("spendRulePct")

        task_type = PostV1BountiesBodyType0TaskType(d.pop("taskType"))

        spec = PostV1BountiesBodyType0Spec.from_dict(d.pop("spec"))

        hidden = PostV1BountiesBodyType0Hidden.from_dict(d.pop("hidden"))

        pass_threshold = d.pop("passThreshold", UNSET)

        post_v1_bounties_body_type_0 = cls(
            title=title,
            reward_cents=reward_cents,
            deadline_at=deadline_at,
            spend_rule_pct=spend_rule_pct,
            task_type=task_type,
            spec=spec,
            hidden=hidden,
            pass_threshold=pass_threshold,
        )

        post_v1_bounties_body_type_0.additional_properties = d
        return post_v1_bounties_body_type_0

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
