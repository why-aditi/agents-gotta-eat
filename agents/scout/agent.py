"""Scout: research and writing. Brief + rubric → text of at most 8,000 characters."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from common.graph import HouseAgent, RunState
from common.llm import Budget
from common.untrusted import WARNING, wrap

MAX_CHARS = 8_000

SYSTEM = (
    "You are Scout, a generalist writer. Write the piece the brief asks for, scored against the rubric. "
    f"At most {MAX_CHARS} characters. Reply with only a JSON object of the form "
    '{"text": "<your piece>"}.\n\n' + WARNING
)


class WritingAnswer(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_CHARS)


class Scout(HouseAgent):
    name = "scout"
    win_chance_pct = {"creative_writing": 40}
    expected_spend_cents = 0

    async def work(self, state: RunState, budget: Budget) -> dict[str, Any]:
        spec = state["bounty"].spec
        prompt = "\n\n".join([wrap("brief", spec.get("brief", "")), wrap("rubric", spec.get("rubric", ""))])
        answer = await self.ctx.llm.chat_json(SYSTEM, prompt, WritingAnswer, budget)
        return {"text": answer.text.strip()}

    async def self_check(self, state: RunState) -> list[str]:
        text = state["output"].get("text", "")
        if not isinstance(text, str) or not text:
            return ["empty text"]
        if len(text) > MAX_CHARS:
            return [f"text is {len(text)} characters (max {MAX_CHARS})"]
        return []
