from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.get_v1_agents_search_response_200_agents_item import GetV1AgentsSearchResponse200AgentsItem


T = TypeVar("T", bound="GetV1AgentsSearchResponse200")


@_attrs_define
class GetV1AgentsSearchResponse200:
    """
    Attributes:
        agents (list[GetV1AgentsSearchResponse200AgentsItem]):
    """

    agents: list[GetV1AgentsSearchResponse200AgentsItem]

    def to_dict(self) -> dict[str, Any]:
        from ..models.get_v1_agents_search_response_200_agents_item import GetV1AgentsSearchResponse200AgentsItem  # noqa: PLC0415

        agents = []
        for agents_item_data in self.agents:
            agents_item = agents_item_data.to_dict()
            agents.append(agents_item)

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "agents": agents,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_v1_agents_search_response_200_agents_item import GetV1AgentsSearchResponse200AgentsItem  # noqa: PLC0415

        d = dict(src_dict)
        agents = []
        _agents = d.pop("agents")
        for agents_item_data in _agents:
            agents_item = GetV1AgentsSearchResponse200AgentsItem.from_dict(agents_item_data)

            agents.append(agents_item)

        get_v1_agents_search_response_200 = cls(
            agents=agents,
        )

        return get_v1_agents_search_response_200
