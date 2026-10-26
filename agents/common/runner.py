"""The poller: every poll each enabled agent lists open bounties and runs the graph on new ones.

One run at a time per agent (an asyncio lock). A bounty the agent declined or entered is skipped afterwards; one
that failed before entering is retried on the next poll. POST /wake triggers an immediate poll.
"""

from __future__ import annotations

import asyncio
import contextlib
from collections.abc import Callable

import structlog

from common.api import GottaeatApi
from common.config import AGENT_NAMES, Settings
from common.graph import AgentContext, HouseAgent, RunRecord, run_bounty
from common.llm import LlmClient

log = structlog.get_logger()

AgentFactory = Callable[[AgentContext], HouseAgent]


class AgentWorker:
    def __init__(self, agent: HouseAgent) -> None:
        self.agent = agent
        self.lock = asyncio.Lock()
        self.done: set[str] = set()

    async def poll(self) -> list[RunRecord]:
        if self.lock.locked():
            return []
        async with self.lock:
            records: list[RunRecord] = []
            try:
                bounties = await self.agent.ctx.api.list_open_bounties()
            except Exception as err:  # noqa: BLE001 - the api may be asleep (Render free); next poll retries
                log.warning("poll_failed", agent=self.agent.name, error=repr(err)[:300])
                return records
            for bounty in bounties:
                if bounty.id in self.done:
                    continue
                record = await run_bounty(self.agent, bounty)
                if record.settled:
                    self.done.add(bounty.id)
                records.append(record)
            return records


class Poller:
    def __init__(self, workers: list[AgentWorker], poll_seconds: int) -> None:
        self.workers = workers
        self.poll_seconds = poll_seconds
        self._wake = asyncio.Event()
        self._task: asyncio.Task[None] | None = None

    async def poll_once(self) -> list[RunRecord]:
        results = await asyncio.gather(*(w.poll() for w in self.workers))
        return [r for rs in results for r in rs]

    def wake(self) -> None:
        self._wake.set()

    async def run_forever(self) -> None:
        while True:
            self._wake.clear()
            await self.poll_once()
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(self._wake.wait(), timeout=self.poll_seconds)

    def start(self) -> None:
        if self.workers and self._task is None:
            self._task = asyncio.create_task(self.run_forever())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
            self._task = None
        for w in self.workers:
            await w.agent.ctx.api.aclose()
            await w.agent.ctx.llm.aclose()


def default_factories() -> dict[str, AgentFactory]:
    from grifter.agent import Grifter
    from scout.agent import Scout
    from sieve.agent import Sieve

    return {"sieve": Sieve, "scout": Scout, "grifter": Grifter}


def build_workers(settings: Settings, factories: dict[str, AgentFactory] | None = None) -> list[AgentWorker]:
    factories = factories or default_factories()
    workers: list[AgentWorker] = []
    for name in AGENT_NAMES:
        key = settings.agent_keys.get(name)
        if not key:
            log.warning("agent_disabled", agent=name, reason=f"{name.upper()}_API_KEY is not set")
            continue
        ctx = AgentContext(
            api=GottaeatApi(settings.api_url, key),
            llm=LlmClient(settings.gateway_url, settings.gateway_key),
            payee_agent_id=settings.grifter_payee_agent_id,
        )
        workers.append(AgentWorker(factories[name](ctx)))
        log.info("agent_enabled", agent=name)
    return workers
