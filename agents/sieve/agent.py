"""Sieve: data extraction. Sources + JSON Schema → JSON, self-checked against the bounty's schema.

It also works subcontracts (skill `extraction`): each open job in its inbox gets the task's key facts as JSON.
"""

from __future__ import annotations

import time
from typing import Any

import structlog
from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError
from jsonschema.validators import validator_for
from pydantic import BaseModel

from common.api import JobView
from common.graph import AgentContext, HouseAgent, RunState
from common.hire import decline, deliver, facts_json, list_jobs
from common.llm import Budget
from common.runlog import RunLog, format_cents
from common.untrusted import WARNING, wrap

log = structlog.get_logger()

SYSTEM = (
    "You are Sieve, a precise data-extraction agent. Extract data from the sources into JSON that validates "
    "against the given JSON Schema. Copy values exactly; never invent data. Use integers only, never decimals: "
    "money is integer cents ($4.50 is 450). Reply with only a JSON object of the form "
    '{"data": <the extracted value>}.\n\n' + WARNING
)


FACTS_SYSTEM = (
    "You are Sieve, a precise data-extraction agent, working a job another agent hired you for. The job's task "
    "is below. Pull out the key facts from the material it contains: names, numbers, dates, places, products and "
    "claims. Copy values exactly; never invent facts. Use integers only, never decimals (write other numbers as "
    'text). Reply with only a JSON object of the form {"facts": {"<short name>": <value>, ...}}.\n\n' + WARNING
)
# A job whose extraction fails this many times is declined (releasing the hirer's hold).
MAX_JOB_FAILURES = 2
JOB_STEPS = 4
JOB_TOKENS = 20_000


class ExtractAnswer(BaseModel):
    data: Any


class FactsAnswer(BaseModel):
    facts: dict[str, Any]


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
    has_inbox = True

    def __init__(self, ctx: AgentContext) -> None:
        super().__init__(ctx)
        self.job_failures: dict[str, int] = {}

    async def check_inbox(self) -> int:
        """Delivers every open job in the inbox: the task's key facts as JSON text."""
        delivered = 0
        for job in await list_jobs(self.ctx.api):
            if job.status != "open":
                continue
            if job.hirer_agent_id == job.worker_agent_id:
                # The api refuses self-hire; never work one anyway.
                log.warning("job_skipped", subcontract=job.id, reason="hired by itself")
                continue
            if await self._work_job(job):
                delivered += 1
        return delivered

    async def _work_job(self, job: JobView) -> bool:
        runlog = RunLog(self.ctx.api, self.name, job.bounty_id)
        budget = Budget(max_steps=JOB_STEPS, max_tokens=JOB_TOKENS)
        started = time.monotonic()
        prompt = wrap(f"task from agent {job.hirer_agent_name}", job.task)
        try:
            answer = await self.ctx.llm.chat_json(FACTS_SYSTEM, prompt, FactsAnswer, budget)
        except Exception as err:  # noqa: BLE001 - LLM, budget or transport: retried on the next check
            failures = self.job_failures.get(job.id, 0) + 1
            self.job_failures[job.id] = failures
            log.warning("job_failed", subcontract=job.id, failures=failures, error=repr(err)[:300])
            if failures >= MAX_JOB_FAILURES and await decline(self.ctx.api, job.id, f"{self.name}:{job.id}:decline"):
                await runlog.step(
                    "work", f"Declined a job for {job.hirer_agent_name}: extraction failed", tool="decline_job"
                )
            return False
        text = facts_json(answer.facts)
        done = await deliver(self.ctx.api, job.id, text, f"{self.name}:{job.id}:deliver")
        if done is None:
            return False
        self.job_failures.pop(job.id, None)
        log.info("job_delivered", subcontract=job.id, hirer=job.hirer_agent_name, facts=len(answer.facts))
        n = len(answer.facts)
        await runlog.step(
            "work",
            f"Delivered {n} fact{'s' if n != 1 else ''} to {job.hirer_agent_name} "
            f"({format_cents(job.amount_cents)} job)",
            tool="deliver_job",
            output=text,
            tokens=budget.tokens,
            latency_ms=int((time.monotonic() - started) * 1000),
        )
        return True

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
