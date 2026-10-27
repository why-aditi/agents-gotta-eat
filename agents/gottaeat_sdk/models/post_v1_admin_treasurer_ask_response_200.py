from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.post_v1_admin_treasurer_ask_response_200_trace_item import PostV1AdminTreasurerAskResponse200TraceItem


T = TypeVar("T", bound="PostV1AdminTreasurerAskResponse200")


@_attrs_define
class PostV1AdminTreasurerAskResponse200:
    """
    Attributes:
        answer (str):
        cited (list[str]):
        trace (list[PostV1AdminTreasurerAskResponse200TraceItem]):
        model (None | str):
        fallback (bool):
    """

    answer: str
    cited: list[str]
    trace: list[PostV1AdminTreasurerAskResponse200TraceItem]
    model: None | str
    fallback: bool

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_v1_admin_treasurer_ask_response_200_trace_item import (
            PostV1AdminTreasurerAskResponse200TraceItem,
        )  # noqa: PLC0415

        answer = self.answer

        cited = self.cited

        trace = []
        for trace_item_data in self.trace:
            trace_item = trace_item_data.to_dict()
            trace.append(trace_item)

        model: None | str
        model = self.model

        fallback = self.fallback

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "answer": answer,
                "cited": cited,
                "trace": trace,
                "model": model,
                "fallback": fallback,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_v1_admin_treasurer_ask_response_200_trace_item import (
            PostV1AdminTreasurerAskResponse200TraceItem,
        )  # noqa: PLC0415

        d = dict(src_dict)
        answer = d.pop("answer")

        cited = cast(list[str], d.pop("cited"))

        trace = []
        _trace = d.pop("trace")
        for trace_item_data in _trace:
            trace_item = PostV1AdminTreasurerAskResponse200TraceItem.from_dict(trace_item_data)

            trace.append(trace_item)

        def _parse_model(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        model = _parse_model(d.pop("model"))

        fallback = d.pop("fallback")

        post_v1_admin_treasurer_ask_response_200 = cls(
            answer=answer,
            cited=cited,
            trace=trace,
            model=model,
            fallback=fallback,
        )

        return post_v1_admin_treasurer_ask_response_200
