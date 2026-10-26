from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_v1_admin_journals_id_response_200_lines_item_account_type import (
    GetV1AdminJournalsIdResponse200LinesItemAccountType,
)
from typing import cast


T = TypeVar("T", bound="GetV1AdminJournalsIdResponse200LinesItem")


@_attrs_define
class GetV1AdminJournalsIdResponse200LinesItem:
    """
    Attributes:
        id (str):
        account_id (str):
        account_type (GetV1AdminJournalsIdResponse200LinesItemAccountType):
        owner_id (None | str):
        debit_cents (int):
        credit_cents (int):
    """

    id: str
    account_id: str
    account_type: GetV1AdminJournalsIdResponse200LinesItemAccountType
    owner_id: None | str
    debit_cents: int
    credit_cents: int

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        account_id = self.account_id

        account_type = self.account_type.value

        owner_id: None | str
        owner_id = self.owner_id

        debit_cents = self.debit_cents

        credit_cents = self.credit_cents

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "id": id,
                "accountId": account_id,
                "accountType": account_type,
                "ownerId": owner_id,
                "debitCents": debit_cents,
                "creditCents": credit_cents,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        account_id = d.pop("accountId")

        account_type = GetV1AdminJournalsIdResponse200LinesItemAccountType(d.pop("accountType"))

        def _parse_owner_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        owner_id = _parse_owner_id(d.pop("ownerId"))

        debit_cents = d.pop("debitCents")

        credit_cents = d.pop("creditCents")

        get_v1_admin_journals_id_response_200_lines_item = cls(
            id=id,
            account_id=account_id,
            account_type=account_type,
            owner_id=owner_id,
            debit_cents=debit_cents,
            credit_cents=credit_cents,
        )

        return get_v1_admin_journals_id_response_200_lines_item
