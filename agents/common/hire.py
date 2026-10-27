"""Hiring other agents through subcontracts (sub-01), and the worker side's inbox.

Every helper here is best-effort: an api failure is logged and returned as "nothing" (an empty list, None or
False), never raised, so a hire that goes wrong can't break a bounty run or a poll. Money-moving POSTs carry a
deterministic Idempotency-Key, so a retried run replays instead of hiring or paying twice.

A job's task and deliverable are another agent's text: untrusted data. Wrap them (common.untrusted.wrap) before
they go into any prompt.
"""

from __future__ import annotations

import asyncio
import json
import time
from collections.abc import Awaitable, Callable

import structlog

from common.api import AgentCard, GottaeatApi, HireResult, JobView
from common.llm import parse_json_object

log = structlog.get_logger()

WAIT_SECONDS = 120
POLL_SECONDS = 5
# Statuses after which a job will never be delivered.
DEAD = frozenset({"declined", "cancelled", "expired", "rejected"})
# A delivered job (or one already accepted, e.g. by an earlier run of the same step).
HAS_DELIVERABLE = frozenset({"delivered", "accepted"})

Sleep = Callable[[float], Awaitable[None]]
Clock = Callable[[], float]


def hire_key(agent: str, bounty_id: str | None, step: str) -> str:
    """Idempotency-Key for a hire: one per agent, bounty and step."""
    return f"{agent}:{bounty_id or 'none'}:{step}"


async def find_agents(
    api: GottaeatApi, skill: str, min_rating_tenths: int = 0, *, exclude_id: str | None = None
) -> list[AgentCard]:
    """Active agents with the skill, best rated first. Empty on any failure."""
    try:
        found = await api.search_agents(skill, min_rating_tenths)
    except Exception as err:  # noqa: BLE001 - a failed search means "nobody to hire"
        log.warning("find_agents_failed", skill=skill, error=repr(err)[:300])
        return []
    return [a for a in found if a.id != exclude_id]


async def hire(
    api: GottaeatApi,
    *,
    hirer: str,
    worker_agent_id: str,
    task: str,
    amount_cents: int,
    reason: str,
    bounty_id: str | None,
    step: str = "hire",
    deliver_by_minutes: int | None = None,
) -> HireResult | None:
    """POST /v1/subcontracts. None on failure; a deny comes back as a result with no job."""
    key = hire_key(hirer, bounty_id, step)
    try:
        res = await api.create_subcontract(
            worker_agent_id=worker_agent_id,
            task=task,
            amount_cents=amount_cents,
            reason=reason,
            bounty_id=bounty_id,
            deliver_by_minutes=deliver_by_minutes,
            idempotency_key=key,
        )
    except Exception as err:  # noqa: BLE001
        log.warning("hire_failed", hirer=hirer, worker=worker_agent_id, bounty=bounty_id, error=repr(err)[:300])
        return None
    log.info(
        "hired" if res.job else "hire_denied",
        hirer=hirer,
        worker=worker_agent_id,
        bounty=bounty_id,
        subcontract=res.job.id if res.job else None,
        job_status=res.job.status if res.job else None,
        decision=res.spend.decision,
        reasons=res.spend.reasons,
    )
    return res


async def wait_for_delivery(
    api: GottaeatApi,
    subcontract_id: str,
    timeout_seconds: float = WAIT_SECONDS,
    *,
    poll_seconds: float = POLL_SECONDS,
    sleep: Sleep = asyncio.sleep,
    clock: Clock = time.monotonic,
) -> JobView | None:
    """Polls the job until it has a deliverable. None on timeout or once it can never be delivered.

    A read that fails is logged and retried until the timeout.
    """
    started = clock()
    while True:
        try:
            job = await api.get_subcontract(subcontract_id)
        except Exception as err:  # noqa: BLE001
            log.warning("job_read_failed", subcontract=subcontract_id, error=repr(err)[:300])
        else:
            if job.status in HAS_DELIVERABLE and job.deliverable is not None:
                return job
            if job.status in DEAD:
                log.info("job_dead", subcontract=subcontract_id, job_status=job.status)
                return None
        if clock() - started >= timeout_seconds:
            log.info("job_wait_timeout", subcontract=subcontract_id, seconds=timeout_seconds)
            return None
        await sleep(poll_seconds)


def rate_deliverable(text: str) -> int:
    """The rating a fact-finding job earns: 5 when the deliverable is a JSON object or array, else 3.

    Floats count as unparseable (agents never handle floats).
    """
    try:
        value = parse_json_object(text)
    except ValueError:
        return 3
    return 5 if isinstance(value, dict | list) else 3


async def accept(api: GottaeatApi, subcontract_id: str, rating: int, idempotency_key: str) -> JobView | None:
    """Accepts a delivered job (pays the worker). None on failure."""
    try:
        return await api.accept_subcontract(subcontract_id, rating, idempotency_key)
    except Exception as err:  # noqa: BLE001
        log.warning("accept_failed", subcontract=subcontract_id, error=repr(err)[:300])
        return None


async def cancel(api: GottaeatApi, subcontract_id: str, idempotency_key: str) -> bool:
    """Cancels a job that is still offered or open (releases the hold). False on failure."""
    try:
        await api.cancel_subcontract(subcontract_id, idempotency_key)
    except Exception as err:  # noqa: BLE001
        log.warning("cancel_failed", subcontract=subcontract_id, error=repr(err)[:300])
        return False
    return True


# --- worker side ---


async def list_jobs(api: GottaeatApi) -> list[JobView]:
    """The agent's inbox (jobs where it is the worker). Empty on failure."""
    try:
        return await api.inbox()
    except Exception as err:  # noqa: BLE001
        log.warning("inbox_failed", error=repr(err)[:300])
        return []


async def deliver(api: GottaeatApi, subcontract_id: str, text: str, idempotency_key: str) -> JobView | None:
    try:
        return await api.deliver_subcontract(subcontract_id, text, idempotency_key)
    except Exception as err:  # noqa: BLE001
        log.warning("deliver_failed", subcontract=subcontract_id, error=repr(err)[:300])
        return None


async def decline(api: GottaeatApi, subcontract_id: str, idempotency_key: str) -> bool:
    try:
        await api.decline_subcontract(subcontract_id, idempotency_key)
    except Exception as err:  # noqa: BLE001
        log.warning("decline_failed", subcontract=subcontract_id, error=repr(err)[:300])
        return False
    return True


def facts_json(facts: object) -> str:
    """The text a fact-finding job delivers."""
    return json.dumps({"facts": facts}, ensure_ascii=False, sort_keys=True)
