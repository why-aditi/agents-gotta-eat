from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_v1_admin_llm_usage_response_200_recent_item_outcome import (
    GetV1AdminLlmUsageResponse200RecentItemOutcome,
)
from ..models.get_v1_admin_llm_usage_response_200_recent_item_role import GetV1AdminLlmUsageResponse200RecentItemRole
from typing import cast
import datetime


T = TypeVar("T", bound="GetV1AdminLlmUsageResponse200RecentItem")


@_attrs_define
class GetV1AdminLlmUsageResponse200RecentItem:
    """
    Attributes:
        id (str):
        role (GetV1AdminLlmUsageResponse200RecentItemRole):
        model (str):
        served_model (None | str):
        outcome (GetV1AdminLlmUsageResponse200RecentItemOutcome):
        latency_ms (int):
        prompt_tokens (int | None):
        completion_tokens (int | None):
        created_at (datetime.datetime):
    """

    id: str
    role: GetV1AdminLlmUsageResponse200RecentItemRole
    model: str
    served_model: None | str
    outcome: GetV1AdminLlmUsageResponse200RecentItemOutcome
    latency_ms: int
    prompt_tokens: int | None
    completion_tokens: int | None
    created_at: datetime.datetime

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        role = self.role.value

        model = self.model

        served_model: None | str
        served_model = self.served_model

        outcome = self.outcome.value

        latency_ms = self.latency_ms

        prompt_tokens: int | None
        prompt_tokens = self.prompt_tokens

        completion_tokens: int | None
        completion_tokens = self.completion_tokens

        created_at = self.created_at.isoformat()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "role": role,
                "model": model,
                "servedModel": served_model,
                "outcome": outcome,
                "latencyMs": latency_ms,
                "promptTokens": prompt_tokens,
                "completionTokens": completion_tokens,
                "createdAt": created_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        role = GetV1AdminLlmUsageResponse200RecentItemRole(d.pop("role"))

        model = d.pop("model")

        def _parse_served_model(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        served_model = _parse_served_model(d.pop("servedModel"))

        outcome = GetV1AdminLlmUsageResponse200RecentItemOutcome(d.pop("outcome"))

        latency_ms = d.pop("latencyMs")

        def _parse_prompt_tokens(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        prompt_tokens = _parse_prompt_tokens(d.pop("promptTokens"))

        def _parse_completion_tokens(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        completion_tokens = _parse_completion_tokens(d.pop("completionTokens"))

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        get_v1_admin_llm_usage_response_200_recent_item = cls(
            id=id,
            role=role,
            model=model,
            served_model=served_model,
            outcome=outcome,
            latency_ms=latency_ms,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            created_at=created_at,
        )

        return get_v1_admin_llm_usage_response_200_recent_item
