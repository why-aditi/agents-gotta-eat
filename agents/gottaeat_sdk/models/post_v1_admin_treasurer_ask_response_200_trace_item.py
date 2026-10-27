from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.post_v1_admin_treasurer_ask_response_200_trace_item_args import (
        PostV1AdminTreasurerAskResponse200TraceItemArgs,
    )


T = TypeVar("T", bound="PostV1AdminTreasurerAskResponse200TraceItem")


@_attrs_define
class PostV1AdminTreasurerAskResponse200TraceItem:
    """
    Attributes:
        tool (str):
        args (PostV1AdminTreasurerAskResponse200TraceItemArgs):
        ok (bool):
        summary (str):
    """

    tool: str
    args: PostV1AdminTreasurerAskResponse200TraceItemArgs
    ok: bool
    summary: str

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_v1_admin_treasurer_ask_response_200_trace_item_args import (
            PostV1AdminTreasurerAskResponse200TraceItemArgs,
        )  # noqa: PLC0415

        tool = self.tool

        args = self.args.to_dict()

        ok = self.ok

        summary = self.summary

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "tool": tool,
                "args": args,
                "ok": ok,
                "summary": summary,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_v1_admin_treasurer_ask_response_200_trace_item_args import (
            PostV1AdminTreasurerAskResponse200TraceItemArgs,
        )  # noqa: PLC0415

        d = dict(src_dict)
        tool = d.pop("tool")

        args = PostV1AdminTreasurerAskResponse200TraceItemArgs.from_dict(d.pop("args"))

        ok = d.pop("ok")

        summary = d.pop("summary")

        post_v1_admin_treasurer_ask_response_200_trace_item = cls(
            tool=tool,
            args=args,
            ok=ok,
            summary=summary,
        )

        return post_v1_admin_treasurer_ask_response_200_trace_item
