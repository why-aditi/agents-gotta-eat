"""Test helpers: a fake LLM (httpx MockTransport), respx for the api, and bounty fixtures."""

from __future__ import annotations

import json
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import httpx
import pytest
import respx

from common.api import BountyView, GottaeatApi
from common.graph import AgentContext
from common.llm import LlmClient

API = "http://api.test"
GATEWAY = "http://gateway.test"
REPO = Path(__file__).resolve().parents[2]


def load_seed_bounty(name: str, bounty_id: str) -> BountyView:
    raw = json.loads((REPO / "seed" / "bounties" / f"{name}.json").read_text())
    return BountyView(
        id=bounty_id,
        task_type=raw["taskType"],
        title=raw["title"],
        spec=raw["spec"],
        reward_cents=raw["rewardCents"],
        spend_rule_pct=raw["spendRulePct"],
    )


def perfect_invoice_data() -> Any:
    return json.loads((REPO / "seed" / "answers" / "extract-invoices.perfect.json").read_text())["content"]["data"]


def bounty_json(b: BountyView) -> dict[str, Any]:
    return {
        "id": b.id,
        "posterId": "usr_poster",
        "taskType": b.task_type,
        "title": b.title,
        "spec": b.spec,
        "rewardCents": b.reward_cents,
        "feeCents": b.reward_cents // 10,
        "spendRulePct": b.spend_rule_pct,
        "passThreshold": 60,
        "deadlineAt": "2026-10-28T12:00:00.000Z",
        "status": "open",
        "openedAt": "2026-10-26T12:00:00.000Z",
        "entryCount": 0,
        "createdAt": "2026-10-26T11:00:00.000Z",
    }


def entry_json(entry_id: str, bounty_id: str, status: str = "active") -> dict[str, Any]:
    return {
        "id": entry_id,
        "bountyId": bounty_id,
        "agentId": "agt_me",
        "status": status,
        "stakeSpendRequestId": "spr_stake",
        "submissionId": None,
        "createdAt": "2026-10-26T12:00:00.000Z",
    }


def enter_json(entry_id: str | None, bounty_id: str, decision: str = "allow", status: str = "active") -> dict[str, Any]:
    return {
        "entry": entry_json(entry_id, bounty_id, status) if entry_id else None,
        "stake": {"spendRequestId": "spr_stake", "decision": decision, "reasons": []},
    }


class FakeLlm:
    """Replies with each scripted content in turn (dicts are JSON-encoded), counting `tokens` per call."""

    def __init__(self, replies: list[Any], tokens: int = 100) -> None:
        self.replies = list(replies)
        self.tokens = tokens
        self.requests: list[dict[str, Any]] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        self.requests.append(body)
        if not self.replies:
            return httpx.Response(500, json={"error": "no more scripted replies"})
        reply = self.replies.pop(0)
        content = reply if isinstance(reply, str) else json.dumps(reply)
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"role": "assistant", "content": content}}],
                "usage": {"total_tokens": self.tokens},
            },
        )

    def client(self) -> LlmClient:
        return LlmClient(GATEWAY, "test-key", transport=httpx.MockTransport(self.handler))


RUN_STEP_ROUTE = "agent_runs"


@pytest.fixture
def api_mock() -> Iterator[respx.MockRouter]:
    with respx.mock(base_url=API, assert_all_called=False) as router:
        # Run steps are accepted by default; tests read them through run_steps(router).
        router.post("/v1/agent-runs", name=RUN_STEP_ROUTE).respond(201, json={"id": "run_1"})
        yield router


def run_steps(router: respx.MockRouter) -> list[dict[str, Any]]:
    """The bodies POSTed to /v1/agent-runs, in order."""
    return [json.loads(call.request.content) for call in router.routes[RUN_STEP_ROUTE].calls]


MakeCtx = Callable[..., AgentContext]


@pytest.fixture
def make_ctx() -> MakeCtx:
    def make(llm: FakeLlm | None = None, payee: str = "") -> AgentContext:
        return AgentContext(
            api=GottaeatApi(API, "gte_agent_test"),
            llm=(llm or FakeLlm([])).client(),
            payee_agent_id=payee,
        )

    return make
