from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_v1_bounties_id_results_response_200_status import GetV1BountiesIdResultsResponse200Status
from typing import cast
import datetime

if TYPE_CHECKING:
    from ..models.get_v1_bounties_id_results_response_200_dispute_type_0 import (
        GetV1BountiesIdResultsResponse200DisputeType0,
    )
    from ..models.get_v1_bounties_id_results_response_200_entries_item import (
        GetV1BountiesIdResultsResponse200EntriesItem,
    )


T = TypeVar("T", bound="GetV1BountiesIdResultsResponse200")


@_attrs_define
class GetV1BountiesIdResultsResponse200:
    """
    Attributes:
        bounty_id (str):
        status (GetV1BountiesIdResultsResponse200Status):
        winner_entry_id (None | str):
        settled_at (datetime.datetime | None):
        entries (list[GetV1BountiesIdResultsResponse200EntriesItem]):
        dispute_until (datetime.datetime | None):
        dispute (GetV1BountiesIdResultsResponse200DisputeType0 | None):
    """

    bounty_id: str
    status: GetV1BountiesIdResultsResponse200Status
    winner_entry_id: None | str
    settled_at: datetime.datetime | None
    entries: list[GetV1BountiesIdResultsResponse200EntriesItem]
    dispute_until: datetime.datetime | None
    dispute: GetV1BountiesIdResultsResponse200DisputeType0 | None

    def to_dict(self) -> dict[str, Any]:
        from ..models.get_v1_bounties_id_results_response_200_dispute_type_0 import (
            GetV1BountiesIdResultsResponse200DisputeType0,
        )  # noqa: PLC0415
        from ..models.get_v1_bounties_id_results_response_200_entries_item import (
            GetV1BountiesIdResultsResponse200EntriesItem,
        )  # noqa: PLC0415

        bounty_id = self.bounty_id

        status = self.status.value

        winner_entry_id: None | str
        winner_entry_id = self.winner_entry_id

        settled_at: None | str
        if isinstance(self.settled_at, datetime.datetime):
            settled_at = self.settled_at.isoformat()
        else:
            settled_at = self.settled_at

        entries = []
        for entries_item_data in self.entries:
            entries_item = entries_item_data.to_dict()
            entries.append(entries_item)

        dispute_until: None | str
        if isinstance(self.dispute_until, datetime.datetime):
            dispute_until = self.dispute_until.isoformat()
        else:
            dispute_until = self.dispute_until

        dispute: dict[str, Any] | None
        if isinstance(self.dispute, GetV1BountiesIdResultsResponse200DisputeType0):
            dispute = self.dispute.to_dict()
        else:
            dispute = self.dispute

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "bountyId": bounty_id,
                "status": status,
                "winnerEntryId": winner_entry_id,
                "settledAt": settled_at,
                "entries": entries,
                "disputeUntil": dispute_until,
                "dispute": dispute,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_v1_bounties_id_results_response_200_dispute_type_0 import (
            GetV1BountiesIdResultsResponse200DisputeType0,
        )  # noqa: PLC0415
        from ..models.get_v1_bounties_id_results_response_200_entries_item import (
            GetV1BountiesIdResultsResponse200EntriesItem,
        )  # noqa: PLC0415

        d = dict(src_dict)
        bounty_id = d.pop("bountyId")

        status = GetV1BountiesIdResultsResponse200Status(d.pop("status"))

        def _parse_winner_entry_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        winner_entry_id = _parse_winner_entry_id(d.pop("winnerEntryId"))

        def _parse_settled_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                settled_at_type_0 = datetime.datetime.fromisoformat(data)

                return settled_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        settled_at = _parse_settled_at(d.pop("settledAt"))

        entries = []
        _entries = d.pop("entries")
        for entries_item_data in _entries:
            entries_item = GetV1BountiesIdResultsResponse200EntriesItem.from_dict(entries_item_data)

            entries.append(entries_item)

        def _parse_dispute_until(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                dispute_until_type_0 = datetime.datetime.fromisoformat(data)

                return dispute_until_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        dispute_until = _parse_dispute_until(d.pop("disputeUntil"))

        def _parse_dispute(data: object) -> GetV1BountiesIdResultsResponse200DisputeType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                dispute_type_0 = GetV1BountiesIdResultsResponse200DisputeType0.from_dict(data)

                return dispute_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(GetV1BountiesIdResultsResponse200DisputeType0 | None, data)

        dispute = _parse_dispute(d.pop("dispute"))

        get_v1_bounties_id_results_response_200 = cls(
            bounty_id=bounty_id,
            status=status,
            winner_entry_id=winner_entry_id,
            settled_at=settled_at,
            entries=entries,
            dispute_until=dispute_until,
            dispute=dispute,
        )

        return get_v1_bounties_id_results_response_200
