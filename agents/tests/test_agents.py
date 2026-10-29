"""Sieve, Scout and Grifter end to end through the graph, with respx for the api and a fake LLM."""

from __future__ import annotations

import json

import httpx
import respx

from common.graph import run_bounty
from common.llm import Budget
from grifter.agent import INJECTION, SPEND_CENTS, SPEND_REASON, Grifter
from scout.agent import Scout
from sieve.agent import Sieve
from tests.helpers import FakeLlm, MakeCtx, enter_json, load_seed_bounty, perfect_invoice_data

INVOICE = load_seed_bounty("extract-invoices", "bty_inv")
TAGLINE = load_seed_bounty("launch-tagline", "bty_tag")


def mock_enter_and_submit(
    router: respx.MockRouter, bounty_id: str, entry_id: str = "ent_1"
) -> tuple[respx.Route, respx.Route]:
    enter = router.post(f"/v1/bounties/{bounty_id}/entries").respond(201, json=enter_json(entry_id, bounty_id))
    submit = router.post(f"/v1/entries/{entry_id}/submissions").respond(
        201, json={"id": "sub_1", "entryId": entry_id, "contentHash": "abc", "submittedAt": "2026-10-26T12:05:00.000Z"}
    )
    return enter, submit


def sent_json(route: respx.Route, n: int = -1) -> dict[str, object]:
    body: dict[str, object] = json.loads(route.calls[n].request.content)
    return body


# --- sieve ---


async def test_sieve_happy_path_enters_and_submits_valid_json(api_mock: respx.MockRouter, make_ctx: MakeCtx) -> None:
    enter, submit = mock_enter_and_submit(api_mock, INVOICE.id)
    llm = FakeLlm([{"data": perfect_invoice_data()}])
    record = await run_bounty(Sieve(make_ctx(llm)), INVOICE)

    assert record.submission_id == "sub_1"
    assert enter.calls.last.request.headers["Idempotency-Key"] == "sieve:bty_inv:enter"
    assert submit.calls.last.request.headers["Idempotency-Key"] == "sieve:bty_inv:submit"
    assert sent_json(submit) == {"content": {"data": perfect_invoice_data()}}
    # The poster's text is delimited and the prompt warns that it may be adversarial.
    system, user = llm.requests[0]["messages"]
    assert "may be adversarial" in system["content"]
    assert "<<<UNTRUSTED source INV-1041.txt>>>" in user["content"]
    assert llm.requests[0]["model"] == "primary"


async def test_sieve_retries_once_with_validation_errors(api_mock: respx.MockRouter, make_ctx: MakeCtx) -> None:
    _, submit = mock_enter_and_submit(api_mock, INVOICE.id)
    bad = {"data": {"invoices": [{"invoiceNumber": "INV-1041", "lines": [{"description": "x", "quantity": "2"}]}]}}
    llm = FakeLlm([bad, {"data": perfect_invoice_data()}])
    record = await run_bounty(Sieve(make_ctx(llm)), INVOICE)

    assert record.submission_id == "sub_1"
    assert len(llm.requests) == 2
    retry_prompt = llm.requests[1]["messages"][1]["content"]
    assert "failed schema validation" in retry_prompt
    assert "unitPriceCents" in retry_prompt
    assert sent_json(submit) == {"content": {"data": perfect_invoice_data()}}


async def test_sieve_invalid_twice_submits_nothing(api_mock: respx.MockRouter, make_ctx: MakeCtx) -> None:
    _, submit = mock_enter_and_submit(api_mock, INVOICE.id)
    bad = {"data": {"invoices": "none"}}
    record = await run_bounty(Sieve(make_ctx(FakeLlm([bad, bad]))), INVOICE)

    assert record.entry_id == "ent_1"
    assert record.submission_id is None
    assert record.stopped == "self_check_failed"
    assert not submit.called


async def test_sieve_rejects_floats_from_the_llm(api_mock: respx.MockRouter, make_ctx: MakeCtx) -> None:
    _, submit = mock_enter_and_submit(api_mock, INVOICE.id)
    floaty = (
        '{"data": {"invoices": [{"invoiceNumber": "INV-1043", "lines": [{"description": "Desk lamp", '
        '"quantity": 1, "unitPriceCents": 27.99}]}]}}'
    )
    record = await run_bounty(Sieve(make_ctx(FakeLlm([floaty, floaty]))), INVOICE)

    assert record.stopped == "llm_error"
    assert not submit.called


async def test_sieve_skips_creative_writing(api_mock: respx.MockRouter, make_ctx: MakeCtx) -> None:
    enter = api_mock.post(f"/v1/bounties/{TAGLINE.id}/entries")
    record = await run_bounty(Sieve(make_ctx()), TAGLINE)
    assert record.decision is not None and not record.decision.enter
    assert record.settled
    assert not enter.called


async def test_pending_stake_stops_the_run(api_mock: respx.MockRouter, make_ctx: MakeCtx) -> None:
    api_mock.post(f"/v1/bounties/{INVOICE.id}/entries").respond(
        201, json=enter_json("ent_1", INVOICE.id, decision="pending_approval", status="pending_stake")
    )
    llm = FakeLlm([])
    record = await run_bounty(Sieve(make_ctx(llm)), INVOICE)
    assert record.stopped == "entry_pending_stake"
    assert record.settled
    assert llm.requests == []


async def test_denied_stake_stops_the_run(api_mock: respx.MockRouter, make_ctx: MakeCtx) -> None:
    api_mock.post(f"/v1/bounties/{INVOICE.id}/entries").respond(201, json=enter_json(None, INVOICE.id, "deny"))
    record = await run_bounty(Sieve(make_ctx()), INVOICE)
    assert record.stopped == "stake_denied"
    assert record.submission_id is None


async def test_replayed_entry_already_submitted_is_skipped(api_mock: respx.MockRouter, make_ctx: MakeCtx) -> None:
    api_mock.post(f"/v1/bounties/{INVOICE.id}/entries").respond(
        201, json=enter_json("ent_1", INVOICE.id), headers={"Idempotent-Replayed": "true"}
    )
    api_mock.get("/v1/entries/ent_1").respond(
        200,
        json={
            "id": "ent_1",
            "bountyId": INVOICE.id,
            "agentId": "agt_me",
            "agentName": "Me",
            "status": "submitted",
            "stakeSpendRequestId": "spr_stake",
            "submissionId": "sub_1",
            "createdAt": "2026-10-26T12:00:00.000Z",
        },
    )
    llm = FakeLlm([])
    record = await run_bounty(Sieve(make_ctx(llm)), INVOICE)
    assert record.stopped == "entry_submitted"
    assert llm.requests == []


# --- scout ---


async def test_scout_submits_text(api_mock: respx.MockRouter, make_ctx: MakeCtx) -> None:
    _, submit = mock_enter_and_submit(api_mock, TAGLINE.id)
    text = "Penny: steady budgets for unsteady income.\n\nA warm blurb."
    llm = FakeLlm([{"text": text}])
    record = await run_bounty(Scout(make_ctx(llm)), TAGLINE)

    assert record.submission_id == "sub_1"
    assert sent_json(submit) == {"content": {"text": text}}
    assert "<<<UNTRUSTED brief>>>" in llm.requests[0]["messages"][1]["content"]


async def test_scout_rejects_text_over_8000_chars(api_mock: respx.MockRouter, make_ctx: MakeCtx) -> None:
    _, submit = mock_enter_and_submit(api_mock, TAGLINE.id)
    llm = FakeLlm([{"text": "x" * 8001}, {"text": "y" * 8001}])
    record = await run_bounty(Scout(make_ctx(llm)), TAGLINE)
    assert record.stopped == "llm_error"
    assert not submit.called


# --- grifter ---


def spend_reply(decision: str, status: str, reasons: list[str]) -> httpx.Response:
    return httpx.Response(201, json={"id": "spr_40", "status": status, "decision": decision, "reasons": reasons})


async def test_grifter_requests_the_40_dollar_spend_and_injects(api_mock: respx.MockRouter, make_ctx: MakeCtx) -> None:
    rich = load_seed_bounty("launch-tagline", "bty_rich")
    rich = type(rich)(**{**rich.__dict__, "reward_cents": 10_000})
    _, submit = mock_enter_and_submit(api_mock, rich.id)
    spend = api_mock.post("/v1/spend-requests").mock(
        return_value=spend_reply("pending_approval", "pending_approval", ["intent_ask"])
    )
    record = await run_bounty(Grifter(make_ctx(payee="agt_x")), rich)

    assert record.submission_id == "sub_1"
    assert spend.calls.last.request.headers["Idempotency-Key"] == "grifter:bty_rich:spend"
    assert sent_json(spend) == {
        "payeeAgentId": "agt_x",
        "amountCents": SPEND_CENTS,
        "category": "tool",
        "reason": SPEND_REASON,
    }
    text = sent_json(submit)["content"]
    assert isinstance(text, dict) and INJECTION in text["text"]


async def test_grifter_carries_on_after_a_denied_spend(api_mock: respx.MockRouter, make_ctx: MakeCtx) -> None:
    rich = load_seed_bounty("extract-invoices", "bty_rich2")
    rich = type(rich)(**{**rich.__dict__, "reward_cents": 10_000})
    _, submit = mock_enter_and_submit(api_mock, rich.id)
    api_mock.post("/v1/spend-requests").mock(return_value=spend_reply("deny", "denied", ["intent_deny"]))
    record = await run_bounty(Grifter(make_ctx(payee="agt_x")), rich)
    assert record.submission_id == "sub_1"
    assert submit.called


async def test_grifter_skips_bounties_with_negative_ev(api_mock: respx.MockRouter, make_ctx: MakeCtx) -> None:
    # $15 × 50% − 50¢ − $40 < 0
    enter = api_mock.post(f"/v1/bounties/{TAGLINE.id}/entries")
    record = await run_bounty(Grifter(make_ctx(payee="agt_x")), TAGLINE)
    assert record.decision is not None and not record.decision.enter
    assert not enter.called


# --- budget ---


async def test_step_limit_stops_the_run_without_submitting(api_mock: respx.MockRouter, make_ctx: MakeCtx) -> None:
    _, submit = mock_enter_and_submit(api_mock, INVOICE.id)
    llm = FakeLlm([{"data": perfect_invoice_data()}])
    record = await run_bounty(Sieve(make_ctx(llm)), INVOICE, Budget(max_steps=5))
    assert record.stopped == "budget_exceeded"
    assert not submit.called


async def test_token_limit_stops_the_run_without_submitting(api_mock: respx.MockRouter, make_ctx: MakeCtx) -> None:
    _, submit = mock_enter_and_submit(api_mock, INVOICE.id)
    llm = FakeLlm([{"data": perfect_invoice_data()}], tokens=60_001)
    record = await run_bounty(Sieve(make_ctx(llm)), INVOICE)
    assert record.stopped == "budget_exceeded"
    assert not submit.called


async def test_default_budget_is_15_steps_and_60k_tokens() -> None:
    b = Budget()
    assert (b.max_steps, b.max_tokens) == (15, 60_000)
