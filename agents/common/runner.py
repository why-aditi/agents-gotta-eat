"""The poller: every poll each enabled agent lists open bounties and runs the graph on new ones.

One run at a time per agent (an asyncio lock). A bounty the agent declined or entered is skipped afterwards; one
that failed before entering is retried on the next poll. POST /wake triggers an immediate poll. Each agent polls in
its own loop; an agent with an inbox (Sieve) also works its subcontracts every INBOX_SECONDS.
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

# How often an agent with an inbox checks it (capped at the poll interval).
INBOX_SECONDS = 15

AgentFactory = Callable[[AgentContext], HouseAgent]


class AgentWorker:
    def __init__(self, agent: HouseAgent) -> None:
        self.agent = agent
        self.lock = asyncio.Lock()
        # Separate from `lock`: a long bounty run (e.g. Scout waiting on a hire) must not hold up deliveries.
        self.inbox_lock = asyncio.Lock()
        self.done: set[str] = set()

    async def check_inbox(self) -> int:
        if not self.agent.has_inbox or self.inbox_lock.locked():
            return 0
        async with self.inbox_lock:
            try:
                return await self.agent.check_inbox()
            except Exception as err:  # noqa: BLE001 - a broken inbox must not kill the poller
                log.warning("inbox_check_failed", agent=self.agent.name, error=repr(err)[:300])
                return 0

    async def poll(self) -> list[RunRecord]:
        await self.check_inbox()
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
    """One loop per agent, so one agent's long run (Scout waiting up to 2 min for Sieve) never delays another's
    poll. Agents with an inbox also check it every `inbox_seconds`."""

    def __init__(self, workers: list[AgentWorker], poll_seconds: int, inbox_seconds: int = INBOX_SECONDS) -> None:
        self.workers = workers
        self.poll_seconds = poll_seconds
        self.inbox_seconds = max(1, min(inbox_seconds, poll_seconds))
        self._wakes = [asyncio.Event() for _ in workers]
        self._tasks: list[asyncio.Task[None]] = []

    async def poll_once(self) -> list[RunRecord]:
        results = await asyncio.gather(*(w.poll() for w in self.workers))
        return [r for rs in results for r in rs]

    def wake(self) -> None:
        for ev in self._wakes:
            ev.set()

    async def _poll_loop(self, worker: AgentWorker, wake: asyncio.Event) -> None:
        while True:
            wake.clear()
            await worker.poll()
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(wake.wait(), timeout=self.poll_seconds)

    async def _inbox_loop(self, worker: AgentWorker) -> None:
        while True:
            await asyncio.sleep(self.inbox_seconds)
            await worker.check_inbox()

    def start(self) -> None:
        if self._tasks:
            return
        for worker, wake in zip(self.workers, self._wakes, strict=True):
            self._tasks.append(asyncio.create_task(self._poll_loop(worker, wake)))
            if worker.agent.has_inbox:
                self._tasks.append(asyncio.create_task(self._inbox_loop(worker)))

    async def stop(self) -> None:
        for task in self._tasks:
            task.cancel()
        for task in self._tasks:
            with contextlib.suppress(asyncio.CancelledError):
                await task
        self._tasks = []
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
