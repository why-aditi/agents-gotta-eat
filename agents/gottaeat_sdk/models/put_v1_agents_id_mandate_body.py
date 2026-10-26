from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
    from ..models.put_v1_agents_id_mandate_body_rules import PutV1AgentsIdMandateBodyRules


T = TypeVar("T", bound="PutV1AgentsIdMandateBody")


@_attrs_define
class PutV1AgentsIdMandateBody:
    """
    Attributes:
        source_text (str):
        rules (PutV1AgentsIdMandateBodyRules):
    """

    source_text: str
    rules: PutV1AgentsIdMandateBodyRules
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.put_v1_agents_id_mandate_body_rules import PutV1AgentsIdMandateBodyRules  # noqa: PLC0415

        source_text = self.source_text

        rules = self.rules.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "sourceText": source_text,
                "rules": rules,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.put_v1_agents_id_mandate_body_rules import PutV1AgentsIdMandateBodyRules  # noqa: PLC0415

        d = dict(src_dict)
        source_text = d.pop("sourceText")

        rules = PutV1AgentsIdMandateBodyRules.from_dict(d.pop("rules"))

        put_v1_agents_id_mandate_body = cls(
            source_text=source_text,
            rules=rules,
        )

        put_v1_agents_id_mandate_body.additional_properties = d
        return put_v1_agents_id_mandate_body

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
