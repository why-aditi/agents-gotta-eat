"""The common house-agent graph (LangGraph StateGraph).

read_bounty → decide_enter → enter → [spend] → plan → work → self_check → submit

self_check may send the run back to work (up to `max_attempts` work passes); still invalid → no submission.
Each agent supplies plan, work and self_check; Grifter also supplies spend. Every node and LLM call is a budget
step; running out of steps or tokens stops the run before submit.

Steps are logged to the live arena (common.runlog): enter_decision, plan, work, self_check, spend, submit, and stop
when a run ends early. Logging never breaks a run.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any, Literal, TypedDict

import structlog
from langgraph.graph import END, START, StateGraph

from common.api import BountyView, GottaeatApi, SpendResult
from common.decide import EnterDecision, decide_enter
from common.llm import Budget, BudgetExceeded, LlmClient, LlmError
from common.runlog import RunLog, format_cents

# How a stopped run reads in the arena feed.
STOP_REASONS = {
    "stake_denied": "the stake was denied",
    "entry_pending_stake": "the stake is waiting for the owner's approval",
    "entry_submitted": "already submitted",
    "entry_withdrawn": "the entry was withdrawn",
    "self_check_failed": "self-check failed after a retry; nothing submitted",
    "budget_exceeded": "out of budget",
    "llm_error": "the model's reply was unusable",
    "error": "an unexpected error",
}

SUPPORTED_TASK_TYPES = ("extract_data", "creative_writing")


class RunState(TypedDict, total=False):
    bounty: BountyView
    decision: EnterDecision
    entry_id: str
    proceed: bool
    plan: str
    # The submission content: {"data": ...} or {"text": ...}.
    output: dict[str, Any]
    attempts: int
    valid: bool
    check_errors: list[str]
    submission_id: str


@dataclass
class RunRecord:
    """What a run did, kept outside the graph state so it survives an exception mid-run."""

    agent: str
    bounty_id: str
    decision: EnterDecision | None = None
    entry_id: str | None = None
    submission_id: str | None = None
    stopped: str | None = None
    events: list[str] = field(default_factory=list)

    @property
    def settled(self) -> bool:
        """Nothing more to do for this bounty: declined, or entered (the run never re-enters)."""
        return (self.decision is not None and not self.decision.enter) or self.entry_id is not None


@dataclass
class AgentContext:
    api: GottaeatApi
    llm: LlmClient
    payee_agent_id: str = ""


class HouseAgent:
    name: str = ""
    win_chance_pct: dict[str, int] = {}
    expected_spend_cents: int = 0
    max_attempts: int = 2
    has_spend: bool = False

    def __init__(self, ctx: AgentContext) -> None:
        self.ctx = ctx

    def key(self, bounty_id: str, step: str) -> str:
        """Deterministic Idempotency-Key, so a retried run replays instead of acting twice."""
        return f"{self.name}:{bounty_id}:{step}"

    async def spend(self, state: RunState, budget: Budget, log: Any) -> SpendResult | None:
        return None

    async def plan(self, state: RunState, budget: Budget) -> str:
        return ""

    async def work(self, state: RunState, budget: Budget) -> dict[str, Any]:
        raise NotImplementedError

    async def self_check(self, state: RunState) -> list[str]:
        """Errors in state["output"]; empty when it is fit to submit."""
        return []


def decision_summary(d: EnterDecision) -> str:
    odds = f"EV {format_cents(d.ev_cents)}, {d.win_chance_pct}% win chance"
    if d.enter:
        return f"Enter: {odds}"
    return f"Skip: {d.reason} ({odds})" if d.win_chance_pct else f"Skip: {d.reason}"


def build_graph(agent: HouseAgent, budget: Budget, record: RunRecord, runlog: RunLog | None = None) -> Any:
    log = structlog.get_logger().bind(agent=agent.name, bounty=record.bounty_id)
    runlog = runlog or RunLog(agent.ctx.api, agent.name, record.bounty_id)

    async def read_bounty(state: RunState) -> RunState:
        budget.step("read_bounty")
        b = state["bounty"]
        log.info("read_bounty", title=b.title, task_type=b.task_type, reward_cents=b.reward_cents)
        return {}

    async def decide(state: RunState) -> RunState:
        budget.step("decide_enter")
        b = state["bounty"]
        chances = {t: p for t, p in agent.win_chance_pct.items() if t in SUPPORTED_TASK_TYPES}
        d = decide_enter(
            task_type=b.task_type,
            reward_cents=b.reward_cents,
            win_chance_pct=chances,
            expected_spend_cents=agent.expected_spend_cents,
        )
        record.decision = d
        log.info(
            "enter_decision",
            enter=d.enter,
            ev_cents=d.ev_cents,
            win_chance_pct=d.win_chance_pct,
            expected_spend_cents=agent.expected_spend_cents,
            reason=d.reason,
        )
        await runlog.step(
            "enter_decision",
            decision_summary(d),
            tool="decide_enter",
            output=json.dumps(
                {
                    "enter": d.enter,
                    "evCents": d.ev_cents,
                    "winChancePct": d.win_chance_pct,
                    "expectedSpendCents": agent.expected_spend_cents,
                    "reason": d.reason,
                }
            ),
        )
        return {"decision": d}

    async def enter(state: RunState) -> RunState:
        budget.step("enter")
        b = state["bounty"]
        res = await agent.ctx.api.enter(b.id, agent.key(b.id, "enter"))
        if res.entry_id is None:
            log.info("entry_denied", stake_decision=res.stake_decision)
            record.stopped = "stake_denied"
            return {"proceed": False}
        record.entry_id = res.entry_id
        status = res.entry_status
        if res.existing:
            # An earlier run entered. Carry on only if that run never submitted.
            status = await agent.ctx.api.entry_status(res.entry_id)
        log.info("entered", entry=res.entry_id, entry_status=status, stake_decision=res.stake_decision)
        if status != "active":
            record.stopped = f"entry_{status}"
            log.info("run_skipped", reason=f"entry is {status}")
            return {"entry_id": res.entry_id, "proceed": False}
        return {"entry_id": res.entry_id, "proceed": True}

    async def spend(state: RunState) -> RunState:
        budget.step("spend")
        res = await agent.spend(state, budget, log)
        if res is not None:
            reasons = f" ({', '.join(res.reasons)})" if res.reasons else ""
            await runlog.step(
                "spend",
                f"{format_cents(res.amount_cents)} {res.category} spend: {res.decision}{reasons}",
                tool="request_spend",
                output=json.dumps({"spendRequestId": res.id, "status": res.status}),
            )
        return {}

    async def plan(state: RunState) -> RunState:
        budget.step("plan")
        tokens, started = budget.tokens, time.monotonic()
        text = await agent.plan(state, budget)
        summary = (
            f"Plan: {text}" if text else f"Plan: up to {agent.max_attempts} work pass(es), self-check before submitting"
        )
        await runlog.step(
            "plan",
            summary,
            output=text or None,
            tokens=budget.tokens - tokens,
            latency_ms=int((time.monotonic() - started) * 1000),
        )
        return {"plan": text}

    async def work(state: RunState) -> RunState:
        budget.step("work")
        tokens, started = budget.tokens, time.monotonic()
        output = await agent.work(state, budget)
        attempts = state.get("attempts", 0) + 1
        log.info("work_done", attempt=attempts)
        await runlog.step(
            "work",
            f"Work pass {attempts} done",
            tool="llm",
            output=json.dumps(output),
            tokens=budget.tokens - tokens,
            latency_ms=int((time.monotonic() - started) * 1000),
        )
        return {"output": output, "attempts": attempts}

    async def self_check(state: RunState) -> RunState:
        budget.step("self_check")
        errors = await agent.self_check(state)
        log.info("self_check", valid=not errors, errors=errors[:5])
        n = len(errors)
        await runlog.step(
            "self_check",
            "Self-check passed" if not errors else f"Self-check failed: {n} error{'s' if n != 1 else ''}",
            output="\n".join(errors[:20]) or None,
        )
        return {"valid": not errors, "check_errors": errors}

    async def submit(state: RunState) -> RunState:
        budget.step("submit")
        b = state["bounty"]
        sid = await agent.ctx.api.submit(state["entry_id"], state["output"], agent.key(b.id, "submit"))
        record.submission_id = sid
        log.info("submitted", entry=state["entry_id"], submission=sid)
        await runlog.step("submit", f"Submitted {sid}", tool="submit_work")
        return {"submission_id": sid}

    def after_decide(state: RunState) -> Literal["enter", "__end__"]:
        return "enter" if state["decision"].enter else "__end__"

    def after_enter(state: RunState) -> Literal["spend", "plan", "__end__"]:
        if not state.get("proceed"):
            return "__end__"
        return "spend" if agent.has_spend else "plan"

    def after_check(state: RunState) -> Literal["submit", "work", "__end__"]:
        if state.get("valid"):
            return "submit"
        if state.get("attempts", 0) < agent.max_attempts:
            return "work"
        record.stopped = "self_check_failed"
        log.info("run_stopped", reason="self-check failed after retry; nothing submitted")
        return "__end__"

    g = StateGraph(RunState)
    g.add_node("read_bounty", read_bounty)
    g.add_node("decide_enter", decide)
    g.add_node("enter", enter)
    g.add_node("spend", spend)
    g.add_node("plan", plan)
    g.add_node("work", work)
    g.add_node("self_check", self_check)
    g.add_node("submit", submit)
    g.add_edge(START, "read_bounty")
    g.add_edge("read_bounty", "decide_enter")
    g.add_conditional_edges("decide_enter", after_decide)
    g.add_conditional_edges("enter", after_enter)
    g.add_edge("spend", "plan")
    g.add_edge("plan", "work")
    g.add_edge("work", "self_check")
    g.add_conditional_edges("self_check", after_check)
    g.add_edge("submit", END)
    return g.compile()


async def run_bounty(agent: HouseAgent, bounty: BountyView, budget: Budget | None = None) -> RunRecord:
    """Runs the graph for one bounty. Never raises for budget, LLM or API failures: they stop the run, logged."""
    budget = budget or Budget()
    record = RunRecord(agent=agent.name, bounty_id=bounty.id)
    log = structlog.get_logger().bind(agent=agent.name, bounty=bounty.id)
    runlog = RunLog(agent.ctx.api, agent.name, bounty.id)
    graph = build_graph(agent, budget, record, runlog)
    try:
        await graph.ainvoke({"bounty": bounty}, {"recursion_limit": 50})
    except BudgetExceeded as err:
        record.stopped = "budget_exceeded"
        log.warning("run_stopped", reason=str(err), steps=budget.steps, tokens=budget.tokens)
    except LlmError as err:
        record.stopped = "llm_error"
        log.warning("run_stopped", reason=str(err))
    except Exception as err:  # noqa: BLE001 - one bad bounty must not kill the poller
        record.stopped = "error"
        log.error("run_failed", error=repr(err)[:500])
    if record.stopped:
        await runlog.step(
            "stop",
            f"Stopped: {STOP_REASONS.get(record.stopped, record.stopped)}",
            output=record.stopped,
            tokens=budget.tokens,
        )
    return record
