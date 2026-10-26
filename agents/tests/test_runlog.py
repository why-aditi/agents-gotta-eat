"""Run steps: the bodies RunLog posts, failures that must not break a run, and the steps a graph run emits."""

from __future__ import annotations

import httpx
import respx

from common.api import GottaeatApi
from common.graph import run_bounty
from common.runlog import MAX_SUMMARY_CHARS, MAX_TEXT_BYTES, RunLog, clip_bytes, format_cents
from grifter.agent import Grifter
from sieve.agent import Sieve
from tests.helpers import API, RUN_STEP_ROUTE, FakeLlm, MakeCtx, load_seed_bounty, perfect_invoice_data, run_steps
from tests.test_agents import mock_enter_and_submit

INVOICE = load_seed_bounty("extract-invoices", "bty_inv")
TAGLINE = load_seed_bounty("launch-tagline", "bty_tag")


def test_format_cents() -> None:
    assert format_cents(1450) == "$14.50"
    assert format_cents(5) == "$0.05"
    assert format_cents(-50) == "-$0.50"
    assert format_cents(123456) == "$1,234.56"


async def test_runlog_posts_the_step_body(api_mock: respx.MockRouter) -> None:
    api = GottaeatApi(API, "gte_agent_test")
    await RunLog(api, "sieve", "bty_1").step(
        "work", "Work pass 1 done", tool="llm", input="in", output="out", tokens=12, latency_ms=34
    )
    await RunLog(api, "sieve", None).step("stop", "Stopped")
    route = api_mock.routes[RUN_STEP_ROUTE]
    assert route.calls[0].request.headers["Authorization"] == "Bearer gte_agent_test"
    assert "Idempotency-Key" not in route.calls[0].request.headers
    assert run_steps(api_mock) == [
        {
            "step": "work",
            "summary": "Work pass 1 done",
            "bountyId": "bty_1",
            "tool": "llm",
            "input": "in",
            "output": "out",
            "tokens": 12,
            "latencyMs": 34,
        },
        {"step": "stop", "summary": "Stopped"},
    ]
    await api.aclose()


def test_runlog_clips_to_the_api_limits() -> None:
    log = RunLog(GottaeatApi(API, "k"), "sieve", "b")
    body = log.body("plan", "line one\nline two " + "x" * 400, output="é" * 3000)
    assert "\n" not in body["summary"]
    assert len(body["summary"]) == MAX_SUMMARY_CHARS
    assert len(body["output"].encode()) <= MAX_TEXT_BYTES
    assert clip_bytes("abc") == "abc"


async def test_api_500_and_timeout_do_not_fail_the_run(api_mock: respx.MockRouter, make_ctx: MakeCtx) -> None:
    failures: list[httpx.Response | Exception] = [
        httpx.Response(500, json={"error": {"code": "internal", "message": "boom"}}),
        httpx.ReadTimeout("slow"),
        httpx.Response(429, json={"error": {"code": "rate_limited", "message": "slow down"}}),
        httpx.ConnectError("down"),
    ]
    api_mock.routes[RUN_STEP_ROUTE].side_effect = failures + [httpx.Response(201, json={"id": "run_x"})] * 10
    _, submit = mock_enter_and_submit(api_mock, INVOICE.id)
    record = await run_bounty(Sieve(make_ctx(FakeLlm([{"data": perfect_invoice_data()}]))), INVOICE)
    assert record.submission_id == "sub_1"
    assert submit.called
    # Every step was still attempted: the first four failed, the fifth (submit) got through.
    assert api_mock.routes[RUN_STEP_ROUTE].call_count == 5


async def test_a_sieve_run_emits_its_steps(api_mock: respx.MockRouter, make_ctx: MakeCtx) -> None:
    mock_enter_and_submit(api_mock, INVOICE.id)
    llm = FakeLlm([{"data": {"invoices": "none"}}, {"data": perfect_invoice_data()}], tokens=150)
    await run_bounty(Sieve(make_ctx(llm)), INVOICE)

    steps = run_steps(api_mock)
    assert [s["step"] for s in steps] == [
        "enter_decision",
        "plan",
        "work",
        "self_check",
        "work",
        "self_check",
        "submit",
    ]
    assert all(s["bountyId"] == INVOICE.id for s in steps)
    decision = steps[0]
    assert decision["summary"].startswith("Enter: EV $")
    assert "% win chance" in decision["summary"]
    assert '"evCents"' in decision["output"]
    assert steps[2]["tokens"] == 150
    assert steps[3]["summary"].startswith("Self-check failed: ")
    assert steps[5]["summary"] == "Self-check passed"
    assert steps[6]["summary"] == "Submitted sub_1"


async def test_a_declined_bounty_logs_only_the_decision(api_mock: respx.MockRouter, make_ctx: MakeCtx) -> None:
    await run_bounty(Sieve(make_ctx()), TAGLINE)
    assert run_steps(api_mock) == [
        {
            "step": "enter_decision",
            "summary": "Skip: not my specialty (creative_writing)",
            "bountyId": TAGLINE.id,
            "tool": "decide_enter",
            "output": (
                '{"enter": false, "evCents": 0, "winChancePct": 0, "expectedSpendCents": 0, '
                '"reason": "not my specialty (creative_writing)"}'
            ),
        }
    ]


async def test_a_stopped_run_logs_stop(api_mock: respx.MockRouter, make_ctx: MakeCtx) -> None:
    mock_enter_and_submit(api_mock, INVOICE.id)
    bad = {"data": {"invoices": "none"}}
    await run_bounty(Sieve(make_ctx(FakeLlm([bad, bad]))), INVOICE)
    last = run_steps(api_mock)[-1]
    assert last["step"] == "stop"
    assert last["summary"] == "Stopped: self-check failed after a retry; nothing submitted"


async def test_grifter_logs_its_spend_decision(api_mock: respx.MockRouter, make_ctx: MakeCtx) -> None:
    rich = load_seed_bounty("launch-tagline", "bty_rich")
    rich = type(rich)(**{**rich.__dict__, "reward_cents": 10_000})
    mock_enter_and_submit(api_mock, rich.id)
    api_mock.post("/v1/spend-requests").respond(
        201,
        json={"id": "spr_40", "status": "pending_approval", "decision": "pending_approval", "reasons": ["intent_ask"]},
    )
    await run_bounty(Grifter(make_ctx(payee="agt_x")), rich)
    spend = next(s for s in run_steps(api_mock) if s["step"] == "spend")
    assert spend["summary"] == "$40.00 tool spend: pending_approval (intent_ask)"
