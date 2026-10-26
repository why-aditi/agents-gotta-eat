"""Run steps for the live arena: each step is POSTed to /v1/agent-runs through the generated client.

Logging is best-effort: a failure (api down, 429, timeout) is logged and swallowed, never breaking a run. The summary
is public (the arena feed shows it), so it never carries secrets. input/output are stored but not shown.
"""

from __future__ import annotations

from typing import Any

import structlog

from common.api import GottaeatApi

MAX_SUMMARY_CHARS = 280
MAX_TEXT_BYTES = 4096

log = structlog.get_logger()


def format_cents(cents: int) -> str:
    """1450 → "$14.50", -50 → "-$0.50". Integer maths only."""
    sign = "-" if cents < 0 else ""
    dollars, rem = divmod(abs(cents), 100)
    return f"{sign}${dollars:,}.{rem:02d}"


def clip_summary(text: str) -> str:
    one_line = " ".join(text.split())
    return one_line if len(one_line) <= MAX_SUMMARY_CHARS else one_line[: MAX_SUMMARY_CHARS - 1] + "…"


def clip_bytes(text: str) -> str:
    data = text.encode("utf-8")
    if len(data) <= MAX_TEXT_BYTES:
        return text
    return data[:MAX_TEXT_BYTES].decode("utf-8", errors="ignore")


class RunLog:
    """One run's step logger, bound to an agent and (usually) a bounty."""

    def __init__(self, api: GottaeatApi, agent: str, bounty_id: str | None) -> None:
        self.api = api
        self.agent = agent
        self.bounty_id = bounty_id

    def body(
        self,
        step: str,
        summary: str,
        *,
        tool: str | None = None,
        input: str | None = None,
        output: str | None = None,
        tokens: int | None = None,
        latency_ms: int | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"step": step, "summary": clip_summary(summary) or step}
        if self.bounty_id:
            body["bountyId"] = self.bounty_id
        if tool:
            body["tool"] = tool[:100]
        if input is not None:
            body["input"] = clip_bytes(input)
        if output is not None:
            body["output"] = clip_bytes(output)
        if tokens is not None:
            body["tokens"] = max(0, tokens)
        if latency_ms is not None:
            body["latencyMs"] = max(0, latency_ms)
        return body

    async def step(
        self,
        step: str,
        summary: str,
        *,
        tool: str | None = None,
        input: str | None = None,
        output: str | None = None,
        tokens: int | None = None,
        latency_ms: int | None = None,
    ) -> None:
        body = self.body(step, summary, tool=tool, input=input, output=output, tokens=tokens, latency_ms=latency_ms)
        try:
            await self.api.log_run_step(body)
        except Exception as err:  # noqa: BLE001 - logging must never break a run
            log.warning("run_log_failed", agent=self.agent, bounty=self.bounty_id, step=step, error=repr(err)[:300])
