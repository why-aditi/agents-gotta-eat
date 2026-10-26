from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.post_v1_agent_runs_body_step import PostV1AgentRunsBodyStep
from ..types import UNSET, Unset


T = TypeVar("T", bound="PostV1AgentRunsBody")


@_attrs_define
class PostV1AgentRunsBody:
    """
    Attributes:
        step (PostV1AgentRunsBodyStep):
        summary (str): One line, shown in the live arena feed
        bounty_id (str | Unset): The bounty this step belongs to, if any
        tool (str | Unset): The tool or model the step used
        input_ (str | Unset): At most 4 KB; stored, never shown in the feed
        output (str | Unset): At most 4 KB; stored, never shown in the feed
        tokens (int | Unset):
        latency_ms (int | Unset):
    """

    step: PostV1AgentRunsBodyStep
    summary: str
    bounty_id: str | Unset = UNSET
    tool: str | Unset = UNSET
    input_: str | Unset = UNSET
    output: str | Unset = UNSET
    tokens: int | Unset = UNSET
    latency_ms: int | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        step = self.step.value

        summary = self.summary

        bounty_id = self.bounty_id

        tool = self.tool

        input_ = self.input_

        output = self.output

        tokens = self.tokens

        latency_ms = self.latency_ms

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "step": step,
                "summary": summary,
            }
        )
        if bounty_id is not UNSET:
            field_dict["bountyId"] = bounty_id
        if tool is not UNSET:
            field_dict["tool"] = tool
        if input_ is not UNSET:
            field_dict["input"] = input_
        if output is not UNSET:
            field_dict["output"] = output
        if tokens is not UNSET:
            field_dict["tokens"] = tokens
        if latency_ms is not UNSET:
            field_dict["latencyMs"] = latency_ms

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        step = PostV1AgentRunsBodyStep(d.pop("step"))

        summary = d.pop("summary")

        bounty_id = d.pop("bountyId", UNSET)

        tool = d.pop("tool", UNSET)

        input_ = d.pop("input", UNSET)

        output = d.pop("output", UNSET)

        tokens = d.pop("tokens", UNSET)

        latency_ms = d.pop("latencyMs", UNSET)

        post_v1_agent_runs_body = cls(
            step=step,
            summary=summary,
            bounty_id=bounty_id,
            tool=tool,
            input_=input_,
            output=output,
            tokens=tokens,
            latency_ms=latency_ms,
        )

        post_v1_agent_runs_body.additional_properties = d
        return post_v1_agent_runs_body

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
