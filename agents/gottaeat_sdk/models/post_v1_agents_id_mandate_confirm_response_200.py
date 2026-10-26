from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
    from ..models.post_v1_agents_id_mandate_confirm_response_200_rules import (
        PostV1AgentsIdMandateConfirmResponse200Rules,
    )


T = TypeVar("T", bound="PostV1AgentsIdMandateConfirmResponse200")


@_attrs_define
class PostV1AgentsIdMandateConfirmResponse200:
    """
    Attributes:
        id (str):
        agent_id (str):
        version (int):
        source_text (str):
        rules (PostV1AgentsIdMandateConfirmResponse200Rules):
        created_at (datetime.datetime):
        confirmed_at (datetime.datetime | None):
    """

    id: str
    agent_id: str
    version: int
    source_text: str
    rules: PostV1AgentsIdMandateConfirmResponse200Rules
    created_at: datetime.datetime
    confirmed_at: datetime.datetime | None

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_v1_agents_id_mandate_confirm_response_200_rules import (
            PostV1AgentsIdMandateConfirmResponse200Rules,
        )  # noqa: PLC0415

        id = self.id

        agent_id = self.agent_id

        version = self.version

        source_text = self.source_text

        rules = self.rules.to_dict()

        created_at = self.created_at.isoformat()

        confirmed_at: None | str
        if isinstance(self.confirmed_at, datetime.datetime):
            confirmed_at = self.confirmed_at.isoformat()
        else:
            confirmed_at = self.confirmed_at

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "agentId": agent_id,
                "version": version,
                "sourceText": source_text,
                "rules": rules,
                "createdAt": created_at,
                "confirmedAt": confirmed_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_v1_agents_id_mandate_confirm_response_200_rules import (
            PostV1AgentsIdMandateConfirmResponse200Rules,
        )  # noqa: PLC0415

        d = dict(src_dict)
        id = d.pop("id")

        agent_id = d.pop("agentId")

        version = d.pop("version")

        source_text = d.pop("sourceText")

        rules = PostV1AgentsIdMandateConfirmResponse200Rules.from_dict(d.pop("rules"))

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        def _parse_confirmed_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                confirmed_at_type_0 = datetime.datetime.fromisoformat(data)

                return confirmed_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        confirmed_at = _parse_confirmed_at(d.pop("confirmedAt"))

        post_v1_agents_id_mandate_confirm_response_200 = cls(
            id=id,
            agent_id=agent_id,
            version=version,
            source_text=source_text,
            rules=rules,
            created_at=created_at,
            confirmed_at=confirmed_at,
        )

        return post_v1_agents_id_mandate_confirm_response_200
