from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_v1_demo_recordings_id_money_response_200_links_item_kind import (
    GetV1DemoRecordingsIdMoneyResponse200LinksItemKind,
)
from typing import cast


T = TypeVar("T", bound="GetV1DemoRecordingsIdMoneyResponse200LinksItem")


@_attrs_define
class GetV1DemoRecordingsIdMoneyResponse200LinksItem:
    """
    Attributes:
        bounty_id (str):
        bounty_title (str):
        kind (GetV1DemoRecordingsIdMoneyResponse200LinksItemKind):
        paypal_id (str):
        url (None | str):
    """

    bounty_id: str
    bounty_title: str
    kind: GetV1DemoRecordingsIdMoneyResponse200LinksItemKind
    paypal_id: str
    url: None | str

    def to_dict(self) -> dict[str, Any]:
        bounty_id = self.bounty_id

        bounty_title = self.bounty_title

        kind = self.kind.value

        paypal_id = self.paypal_id

        url: None | str
        url = self.url

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "bountyId": bounty_id,
                "bountyTitle": bounty_title,
                "kind": kind,
                "paypalId": paypal_id,
                "url": url,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        bounty_id = d.pop("bountyId")

        bounty_title = d.pop("bountyTitle")

        kind = GetV1DemoRecordingsIdMoneyResponse200LinksItemKind(d.pop("kind"))

        paypal_id = d.pop("paypalId")

        def _parse_url(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        url = _parse_url(d.pop("url"))

        get_v1_demo_recordings_id_money_response_200_links_item = cls(
            bounty_id=bounty_id,
            bounty_title=bounty_title,
            kind=kind,
            paypal_id=paypal_id,
            url=url,
        )

        return get_v1_demo_recordings_id_money_response_200_links_item
