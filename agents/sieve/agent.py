"""Sieve: data extraction. Sources + JSON Schema → JSON, self-checked against the bounty's schema."""

from __future__ import annotations

from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError
from jsonschema.validators import validator_for
from pydantic import BaseModel

from common.graph import HouseAgent, RunState
from common.llm import Budget
from common.untrusted import WARNING, wrap

SYSTEM = (
    "You are Sieve, a precise data-extraction agent. Extract data from the sources into JSON that validates "
    "against the given JSON Schema. Copy values exactly; never invent data. Use integers only, never decimals: "
    "money is integer cents ($4.50 is 450). Reply with only a JSON object of the form "
    '{"data": <the extracted value>}.\n\n' + WARNING
)


class ExtractAnswer(BaseModel):
    data: Any


def schema_errors(schema: dict[str, Any], instance: Any) -> list[str]:
    try:
        cls = validator_for(schema, default=Draft202012Validator)
        cls.check_schema(schema)
        validator = cls(schema)
    except SchemaError as err:
        return [f"the bounty's schema is invalid: {err.message}"]
    errors = sorted(validator.iter_errors(instance), key=lambda e: [str(p) for p in e.absolute_path])
    return [f"{'/'.join(str(p) for p in e.absolute_path) or '(root)'}: {e.message}" for e in errors]


class Sieve(HouseAgent):
    name = "sieve"
    win_chance_pct = {"extract_data": 60}
    expected_spend_cents = 0

    def _prompt(self, state: RunState) -> str:
        spec = state["bounty"].spec
        parts = [
            wrap("instructions", spec.get("instructions", "")),
            wrap("json-schema", spec.get("schema", {})),
        ]
        for i, source in enumerate(spec.get("sources", [])):
            name = source.get("name", f"source-{i + 1}") if isinstance(source, dict) else f"source-{i + 1}"
            content = source.get("content", "") if isinstance(source, dict) else source
            parts.append(wrap(f"source {name}", content))
        errors = state.get("check_errors")
        if errors:
            parts.append("Your previous answer failed schema validation:\n" + "\n".join(f"- {e}" for e in errors))
            parts.append("Previous answer:\n" + wrap("previous-answer", state.get("output", {}).get("data")))
        return "\n\n".join(parts)

    async def work(self, state: RunState, budget: Budget) -> dict[str, Any]:
        answer = await self.ctx.llm.chat_json(SYSTEM, self._prompt(state), ExtractAnswer, budget)
        return {"data": answer.data}

    async def self_check(self, state: RunState) -> list[str]:
        schema = state["bounty"].spec.get("schema")
        if not isinstance(schema, dict):
            return ["the bounty has no JSON Schema"]
        return schema_errors(schema, state["output"].get("data"))
