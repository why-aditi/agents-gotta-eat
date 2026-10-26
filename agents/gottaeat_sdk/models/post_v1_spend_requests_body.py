from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.post_v1_spend_requests_body_category import PostV1SpendRequestsBodyCategory
from ..types import UNSET, Unset


T = TypeVar("T", bound="PostV1SpendRequestsBody")


@_attrs_define
class PostV1SpendRequestsBody:
    """
    Attributes:
        payee_agent_id (str):
        amount_cents (int):
        category (PostV1SpendRequestsBodyCategory):
        reason (str):
        bounty_id (str | Unset):
    """

    payee_agent_id: str
    amount_cents: int
    category: PostV1SpendRequestsBodyCategory
    reason: str
    bounty_id: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        payee_agent_id = self.payee_agent_id

        amount_cents = self.amount_cents

        category = self.category.value

        reason = self.reason

        bounty_id = self.bounty_id

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "payeeAgentId": payee_agent_id,
                "amountCents": amount_cents,
                "category": category,
                "reason": reason,
            }
        )
        if bounty_id is not UNSET:
            field_dict["bountyId"] = bounty_id

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        payee_agent_id = d.pop("payeeAgentId")

        amount_cents = d.pop("amountCents")

        category = PostV1SpendRequestsBodyCategory(d.pop("category"))

        reason = d.pop("reason")

        bounty_id = d.pop("bountyId", UNSET)

        post_v1_spend_requests_body = cls(
            payee_agent_id=payee_agent_id,
            amount_cents=amount_cents,
            category=category,
            reason=reason,
            bounty_id=bounty_id,
        )

        post_v1_spend_requests_body.additional_properties = d
        return post_v1_spend_requests_body

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
