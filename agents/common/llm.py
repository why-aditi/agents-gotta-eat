"""LLM calls through the LiteLLM gateway (OpenAI-compatible), with a per-run step and token budget.

Replies are JSON parsed into a Pydantic model, with one repair retry. JSON floats are rejected: the agents never
handle floats, and money is integer cents.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

import httpx
from pydantic import BaseModel, ValidationError

MODEL = "primary"
MAX_STEPS = 15
MAX_TOKENS = 60_000


class BudgetExceeded(Exception):
    pass


class LlmError(Exception):
    pass


@dataclass
class Budget:
    """One run's budget. A step is one graph node or one LLM call; tokens come from the gateway's `usage`."""

    max_steps: int = MAX_STEPS
    max_tokens: int = MAX_TOKENS
    steps: int = 0
    tokens: int = 0
    history: list[str] = field(default_factory=list)

    def step(self, name: str) -> None:
        self.steps += 1
        self.history.append(name)
        if self.steps > self.max_steps:
            raise BudgetExceeded(f"step limit {self.max_steps} reached at {name}")

    def add_tokens(self, n: int) -> None:
        self.tokens += n
        if self.tokens > self.max_tokens:
            raise BudgetExceeded(f"token limit {self.max_tokens} reached ({self.tokens})")


def _no_floats(text: str) -> Any:
    raise ValueError(f"floats are not allowed (got {text}); use integers, e.g. cents")


def parse_json_object(text: str) -> Any:
    """Parses a reply, tolerating a ```json fence. Raises ValueError on bad JSON or any float."""
    body = text.strip()
    if body.startswith("```"):
        body = body.split("\n", 1)[1] if "\n" in body else ""
        body = body.rsplit("```", 1)[0]
    return json.loads(body, parse_float=_no_floats)


class LlmClient:
    def __init__(self, base_url: str, api_key: str, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._url = base_url.rstrip("/") + "/v1/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        self._http = httpx.AsyncClient(headers=headers, timeout=httpx.Timeout(60.0), transport=transport)

    async def aclose(self) -> None:
        await self._http.aclose()

    async def complete(self, messages: list[dict[str, str]], budget: Budget) -> str:
        budget.step("llm")
        res = await self._http.post(
            self._url,
            json={"model": MODEL, "messages": messages, "response_format": {"type": "json_object"}},
        )
        if res.status_code != 200:
            raise LlmError(f"gateway → {res.status_code} {res.text[:300]}")
        body = res.json()
        usage = body.get("usage") or {}
        total = usage.get("total_tokens")
        budget.add_tokens(total if isinstance(total, int) else 0)
        try:
            content = body["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as err:
            raise LlmError("gateway reply has no message content") from err
        if not isinstance(content, str):
            raise LlmError("gateway reply content is not text")
        return content

    async def chat_json[M: BaseModel](self, system: str, user: str, model: type[M], budget: Budget) -> M:
        """One call, plus one repair retry when the reply is not valid JSON for `model`."""
        messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
        reply = await self.complete(messages, budget)
        try:
            return model.model_validate(parse_json_object(reply))
        except (ValueError, ValidationError) as err:
            error = str(err)[:1000]
        messages += [
            {"role": "assistant", "content": reply},
            {
                "role": "user",
                "content": f"That reply was not valid. Error: {error}\n"
                "Reply again with only the corrected JSON object.",
            },
        ]
        reply = await self.complete(messages, budget)
        try:
            return model.model_validate(parse_json_object(reply))
        except (ValueError, ValidationError) as err:
            raise LlmError(f"invalid JSON after one repair: {str(err)[:300]}") from err
