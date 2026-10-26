from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_v1_spend_requests_id_response_200_decisions_item_gate import (
    GetV1SpendRequestsIdResponse200DecisionsItemGate,
)
from ..models.get_v1_spend_requests_id_response_200_decisions_item_verdict import (
    GetV1SpendRequestsIdResponse200DecisionsItemVerdict,
)
from typing import cast
import datetime

if TYPE_CHECKING:
    from ..models.get_v1_spend_requests_id_response_200_decisions_item_detail import (
        GetV1SpendRequestsIdResponse200DecisionsItemDetail,
    )


T = TypeVar("T", bound="GetV1SpendRequestsIdResponse200DecisionsItem")


@_attrs_define
class GetV1SpendRequestsIdResponse200DecisionsItem:
    """
    Attributes:
        gate (GetV1SpendRequestsIdResponse200DecisionsItemGate):
        verdict (GetV1SpendRequestsIdResponse200DecisionsItemVerdict):
        confidence (int | None):
        detail (GetV1SpendRequestsIdResponse200DecisionsItemDetail):
        created_at (datetime.datetime):
    """

    gate: GetV1SpendRequestsIdResponse200DecisionsItemGate
    verdict: GetV1SpendRequestsIdResponse200DecisionsItemVerdict
    confidence: int | None
    detail: GetV1SpendRequestsIdResponse200DecisionsItemDetail
    created_at: datetime.datetime

    def to_dict(self) -> dict[str, Any]:
        from ..models.get_v1_spend_requests_id_response_200_decisions_item_detail import (
            GetV1SpendRequestsIdResponse200DecisionsItemDetail,
        )  # noqa: PLC0415

        gate = self.gate.value

        verdict = self.verdict.value

        confidence: int | None
        confidence = self.confidence

        detail = self.detail.to_dict()

        created_at = self.created_at.isoformat()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "gate": gate,
                "verdict": verdict,
                "confidence": confidence,
                "detail": detail,
                "createdAt": created_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_v1_spend_requests_id_response_200_decisions_item_detail import (
            GetV1SpendRequestsIdResponse200DecisionsItemDetail,
        )  # noqa: PLC0415

        d = dict(src_dict)
        gate = GetV1SpendRequestsIdResponse200DecisionsItemGate(d.pop("gate"))

        verdict = GetV1SpendRequestsIdResponse200DecisionsItemVerdict(d.pop("verdict"))

        def _parse_confidence(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        confidence = _parse_confidence(d.pop("confidence"))

        detail = GetV1SpendRequestsIdResponse200DecisionsItemDetail.from_dict(d.pop("detail"))

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        get_v1_spend_requests_id_response_200_decisions_item = cls(
            gate=gate,
            verdict=verdict,
            confidence=confidence,
            detail=detail,
            created_at=created_at,
        )

        return get_v1_spend_requests_id_response_200_decisions_item
