from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.post_v1_admin_wallets_user_id_credit_response_200_agent_limits_type_0_allowed_categories_item import (
    PostV1AdminWalletsUserIdCreditResponse200AgentLimitsType0AllowedCategoriesItem,
)
from ..models.post_v1_admin_wallets_user_id_credit_response_200_agent_limits_type_0_scope import (
    PostV1AdminWalletsUserIdCreditResponse200AgentLimitsType0Scope,
)
from ..types import UNSET, Unset
from typing import cast
import datetime


T = TypeVar("T", bound="PostV1AdminWalletsUserIdCreditResponse200AgentLimitsType0")


@_attrs_define
class PostV1AdminWalletsUserIdCreditResponse200AgentLimitsType0:
    """
    Attributes:
        per_tx_max_cents (int):
        daily_max_cents (int):
        allowed_categories (list[PostV1AdminWalletsUserIdCreditResponse200AgentLimitsType0AllowedCategoriesItem]):
        payee_allowlist (list[str] | None):
        scope (PostV1AdminWalletsUserIdCreditResponse200AgentLimitsType0Scope):
        ask_above_cents (int | Unset):
        min_payee_rating_tenths (int | Unset):
        expires_at (datetime.datetime | None | Unset):
    """

    per_tx_max_cents: int
    daily_max_cents: int
    allowed_categories: list[PostV1AdminWalletsUserIdCreditResponse200AgentLimitsType0AllowedCategoriesItem]
    payee_allowlist: list[str] | None
    scope: PostV1AdminWalletsUserIdCreditResponse200AgentLimitsType0Scope
    ask_above_cents: int | Unset = UNSET
    min_payee_rating_tenths: int | Unset = UNSET
    expires_at: datetime.datetime | None | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        per_tx_max_cents = self.per_tx_max_cents

        daily_max_cents = self.daily_max_cents

        allowed_categories = []
        for allowed_categories_item_data in self.allowed_categories:
            allowed_categories_item = allowed_categories_item_data.value
            allowed_categories.append(allowed_categories_item)

        payee_allowlist: list[str] | None
        if isinstance(self.payee_allowlist, list):
            payee_allowlist = self.payee_allowlist

        else:
            payee_allowlist = self.payee_allowlist

        scope = self.scope.value

        ask_above_cents = self.ask_above_cents

        min_payee_rating_tenths = self.min_payee_rating_tenths

        expires_at: None | str | Unset
        if isinstance(self.expires_at, Unset):
            expires_at = UNSET
        elif isinstance(self.expires_at, datetime.datetime):
            expires_at = self.expires_at.isoformat()
        else:
            expires_at = self.expires_at

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "perTxMaxCents": per_tx_max_cents,
                "dailyMaxCents": daily_max_cents,
                "allowedCategories": allowed_categories,
                "payeeAllowlist": payee_allowlist,
                "scope": scope,
            }
        )
        if ask_above_cents is not UNSET:
            field_dict["askAboveCents"] = ask_above_cents
        if min_payee_rating_tenths is not UNSET:
            field_dict["minPayeeRatingTenths"] = min_payee_rating_tenths
        if expires_at is not UNSET:
            field_dict["expiresAt"] = expires_at

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        per_tx_max_cents = d.pop("perTxMaxCents")

        daily_max_cents = d.pop("dailyMaxCents")

        allowed_categories = []
        _allowed_categories = d.pop("allowedCategories")
        for allowed_categories_item_data in _allowed_categories:
            allowed_categories_item = PostV1AdminWalletsUserIdCreditResponse200AgentLimitsType0AllowedCategoriesItem(
                allowed_categories_item_data
            )

            allowed_categories.append(allowed_categories_item)

        def _parse_payee_allowlist(data: object) -> list[str] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                payee_allowlist_type_0 = cast(list[str], data)

                return payee_allowlist_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | None, data)

        payee_allowlist = _parse_payee_allowlist(d.pop("payeeAllowlist"))

        scope = PostV1AdminWalletsUserIdCreditResponse200AgentLimitsType0Scope(d.pop("scope"))

        ask_above_cents = d.pop("askAboveCents", UNSET)

        min_payee_rating_tenths = d.pop("minPayeeRatingTenths", UNSET)

        def _parse_expires_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                expires_at_type_0 = datetime.datetime.fromisoformat(data)

                return expires_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        expires_at = _parse_expires_at(d.pop("expiresAt", UNSET))

        post_v1_admin_wallets_user_id_credit_response_200_agent_limits_type_0 = cls(
            per_tx_max_cents=per_tx_max_cents,
            daily_max_cents=daily_max_cents,
            allowed_categories=allowed_categories,
            payee_allowlist=payee_allowlist,
            scope=scope,
            ask_above_cents=ask_above_cents,
            min_payee_rating_tenths=min_payee_rating_tenths,
            expires_at=expires_at,
        )

        return post_v1_admin_wallets_user_id_credit_response_200_agent_limits_type_0
