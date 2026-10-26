"""The poller and the FastAPI app: /wake auth, skipping handled bounties, disabled agents."""

from __future__ import annotations

import respx
from fastapi.testclient import TestClient

from app import create_app
from common.config import Settings
from common.runner import AgentWorker, Poller, build_workers
from sieve.agent import Sieve
from tests.helpers import FakeLlm, MakeCtx, bounty_json, enter_json, load_seed_bounty, perfect_invoice_data

INVOICE = load_seed_bounty("extract-invoices", "bty_inv")
TAGLINE = load_seed_bounty("launch-tagline", "bty_tag")


class SpyPoller(Poller):
    def __init__(self) -> None:
        super().__init__([], 60)
        self.wakes = 0

    def wake(self) -> None:
        self.wakes += 1


def app_with_spy(secret: str) -> tuple[TestClient, SpyPoller]:
    spy = SpyPoller()
    app = create_app(Settings(wake_secret=secret), make_poller=lambda _: spy)
    return TestClient(app), spy


def test_wake_without_secret_is_401() -> None:
    client, spy = app_with_spy("s3cret")
    with client:
        assert client.post("/wake").status_code == 401
        assert client.post("/wake", headers={"X-Wake-Secret": "wrong"}).status_code == 401
    assert spy.wakes == 0


def test_wake_with_secret_is_202_and_polls() -> None:
    client, spy = app_with_spy("s3cret")
    with client:
        res = client.post("/wake", headers={"X-Wake-Secret": "s3cret"})
    assert res.status_code == 202
    assert spy.wakes == 1


def test_wake_is_disabled_when_no_secret_is_configured() -> None:
    client, spy = app_with_spy("")
    with client:
        assert client.post("/wake", headers={"X-Wake-Secret": ""}).status_code == 401
    assert spy.wakes == 0


async def test_poll_skips_bounties_already_handled(api_mock: respx.MockRouter, make_ctx: MakeCtx) -> None:
    api_mock.get("/v1/bounties").respond(200, json={"bounties": [bounty_json(INVOICE), bounty_json(TAGLINE)]})
    enter = api_mock.post(f"/v1/bounties/{INVOICE.id}/entries").respond(201, json=enter_json("ent_1", INVOICE.id))
    api_mock.post("/v1/entries/ent_1/submissions").respond(
        201, json={"id": "sub_1", "entryId": "ent_1", "contentHash": "h", "submittedAt": "2026-10-26T12:05:00.000Z"}
    )
    llm = FakeLlm([{"data": perfect_invoice_data()}])
    worker = AgentWorker(Sieve(make_ctx(llm)))

    first = await worker.poll()
    assert {r.bounty_id for r in first} == {INVOICE.id, TAGLINE.id}
    assert worker.done == {INVOICE.id, TAGLINE.id}

    second = await worker.poll()
    assert second == []
    assert enter.call_count == 1
    assert len(llm.requests) == 1


async def test_failure_before_entering_is_retried(api_mock: respx.MockRouter, make_ctx: MakeCtx) -> None:
    api_mock.get("/v1/bounties").respond(200, json={"bounties": [bounty_json(INVOICE)]})
    api_mock.post(f"/v1/bounties/{INVOICE.id}/entries").respond(503, json={"error": "asleep"})
    worker = AgentWorker(Sieve(make_ctx()))
    [record] = await worker.poll()
    assert record.stopped == "error"
    assert worker.done == set()


async def test_poll_survives_the_api_being_down(api_mock: respx.MockRouter, make_ctx: MakeCtx) -> None:
    api_mock.get("/v1/bounties").respond(502)
    worker = AgentWorker(Sieve(make_ctx()))
    assert await worker.poll() == []


def test_agent_without_key_is_disabled() -> None:
    workers = build_workers(Settings(agent_keys={"sieve": "gte_agent_x"}))
    assert [w.agent.name for w in workers] == ["sieve"]


def test_settings_from_env() -> None:
    s = Settings.from_env(
        {
            "SIEVE_API_KEY": "k1",
            "SCOUT_API_KEY": "",
            "GOTTAEAT_API_URL": "http://api",
            "AGENTS_POLL_SECONDS": "5",
            "GRIFTER_PAYEE_AGENT_ID": "agt_x",
        }
    )
    assert s.agent_keys == {"sieve": "k1"}
    assert s.api_url == "http://api"
    assert s.poll_seconds == 5
    assert s.grifter_payee_agent_id == "agt_x"
    assert Settings.from_env({}).poll_seconds == 60
