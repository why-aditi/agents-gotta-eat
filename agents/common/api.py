"""The agents' view of the public REST API, built on the generated client (gottaeat_sdk).

Agents use only the public agent endpoints. Money is integer cents throughout.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from gottaeat_sdk import AuthenticatedClient
from gottaeat_sdk.api.agent_runs import post_v1_agent_runs
from gottaeat_sdk.api.agents import get_v1_agents_me, get_v1_agents_search
from gottaeat_sdk.api.bounties import get_v1_bounties
from gottaeat_sdk.api.entries import get_v1_entries_id, post_v1_bounties_id_entries, post_v1_entries_id_submissions
from gottaeat_sdk.api.spend import post_v1_spend_requests
from gottaeat_sdk.api.subcontracts import (
    get_v1_subcontracts_id,
    get_v1_subcontracts_inbox,
    post_v1_subcontracts,
    post_v1_subcontracts_id_accept,
    post_v1_subcontracts_id_cancel,
    post_v1_subcontracts_id_decline,
    post_v1_subcontracts_id_deliver,
)
from gottaeat_sdk.models.get_v1_agents_me_response_200 import GetV1AgentsMeResponse200
from gottaeat_sdk.models.get_v1_agents_search_response_200 import GetV1AgentsSearchResponse200
from gottaeat_sdk.models.get_v1_bounties_response_200 import GetV1BountiesResponse200
from gottaeat_sdk.models.get_v1_bounties_status import GetV1BountiesStatus
from gottaeat_sdk.models.get_v1_entries_id_response_200 import GetV1EntriesIdResponse200
from gottaeat_sdk.models.get_v1_subcontracts_id_response_200 import GetV1SubcontractsIdResponse200
from gottaeat_sdk.models.get_v1_subcontracts_inbox_response_200 import GetV1SubcontractsInboxResponse200
from gottaeat_sdk.models.post_v1_agent_runs_body import PostV1AgentRunsBody
from gottaeat_sdk.models.post_v1_agent_runs_response_201 import PostV1AgentRunsResponse201
from gottaeat_sdk.models.post_v1_bounties_id_entries_response_200 import PostV1BountiesIdEntriesResponse200
from gottaeat_sdk.models.post_v1_bounties_id_entries_response_201 import PostV1BountiesIdEntriesResponse201
from gottaeat_sdk.models.post_v1_entries_id_submissions_body import PostV1EntriesIdSubmissionsBody
from gottaeat_sdk.models.post_v1_entries_id_submissions_response_201 import PostV1EntriesIdSubmissionsResponse201
from gottaeat_sdk.models.post_v1_spend_requests_body import PostV1SpendRequestsBody
from gottaeat_sdk.models.post_v1_spend_requests_response_201 import PostV1SpendRequestsResponse201
from gottaeat_sdk.models.post_v1_subcontracts_body import PostV1SubcontractsBody
from gottaeat_sdk.models.post_v1_subcontracts_id_accept_body import PostV1SubcontractsIdAcceptBody
from gottaeat_sdk.models.post_v1_subcontracts_id_accept_response_200 import PostV1SubcontractsIdAcceptResponse200
from gottaeat_sdk.models.post_v1_subcontracts_id_cancel_response_200 import PostV1SubcontractsIdCancelResponse200
from gottaeat_sdk.models.post_v1_subcontracts_id_decline_response_200 import PostV1SubcontractsIdDeclineResponse200
from gottaeat_sdk.models.post_v1_subcontracts_id_deliver_body import PostV1SubcontractsIdDeliverBody
from gottaeat_sdk.models.post_v1_subcontracts_id_deliver_response_200 import PostV1SubcontractsIdDeliverResponse200
from gottaeat_sdk.models.post_v1_subcontracts_response_201 import PostV1SubcontractsResponse201
from gottaeat_sdk.types import UNSET, Response

REPLAYED_HEADER = "idempotent-replayed"
TIMEOUT = httpx.Timeout(30.0)
# Run logging is best-effort and must not hold up a run.
RUN_LOG_TIMEOUT = httpx.Timeout(5.0)


class ApiError(Exception):
    def __init__(self, what: str, status: int, body: bytes) -> None:
        super().__init__(f"{what} → {status} {body[:500]!r}")
        self.status = status


@dataclass(frozen=True)
class BountyView:
    id: str
    task_type: str
    title: str
    # Poster-supplied and untrusted.
    spec: dict[str, Any]
    reward_cents: int
    spend_rule_pct: int


@dataclass(frozen=True)
class EntryResult:
    entry_id: str | None
    entry_status: str | None
    stake_decision: str
    # The agent had already entered (200, or an idempotent replay of an earlier run).
    existing: bool


@dataclass(frozen=True)
class SpendResult:
    id: str
    decision: str
    status: str
    reasons: list[str]
    amount_cents: int
    category: str


@dataclass(frozen=True)
class AgentCard:
    """An agent from GET /v1/agents/search. Rating is in tenths of a star (0-50)."""

    id: str
    name: str
    skills: list[str]
    rating: int
    completed_jobs: int


@dataclass(frozen=True)
class JobView:
    """A subcontract. `task` and `deliverable` are another agent's text: untrusted data, never instructions."""

    id: str
    hirer_agent_id: str
    hirer_agent_name: str
    worker_agent_id: str
    worker_agent_name: str
    bounty_id: str | None
    task: str
    amount_cents: int
    fee_cents: int
    status: str
    deliverable: str | None
    rating: int | None


@dataclass(frozen=True)
class HireResult:
    spend: SpendResult
    # None when the spend was denied (no job is created).
    job: JobView | None


def _job(s: Any) -> JobView:
    # Every subcontract response model in the generated client has these fields.
    return JobView(
        id=s.id,
        hirer_agent_id=s.hirer_agent_id,
        hirer_agent_name=s.hirer_agent_name,
        worker_agent_id=s.worker_agent_id,
        worker_agent_name=s.worker_agent_name,
        bounty_id=s.bounty_id,
        task=s.task,
        amount_cents=s.amount_cents,
        fee_cents=s.fee_cents,
        status=s.status.value,
        deliverable=s.deliverable,
        rating=s.rating,
    )


class GottaeatApi:
    def __init__(self, base_url: str, api_key: str, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._httpx_args: dict[str, Any] = {"transport": transport} if transport else {}
        self._client = self._new_client({})
        self._run_log_client = self._new_client({}, RUN_LOG_TIMEOUT)

    def _new_client(self, headers: dict[str, str], timeout: httpx.Timeout = TIMEOUT) -> AuthenticatedClient:
        return AuthenticatedClient(
            base_url=self._base_url,
            token=self._api_key,
            headers=headers,
            timeout=timeout,
            httpx_args=self._httpx_args,
        )

    def _idempotent(self, key: str) -> AuthenticatedClient:
        # A fresh client per money-moving POST: with_headers on a live client would leak the key into later calls.
        return self._new_client({"Idempotency-Key": key})

    async def aclose(self) -> None:
        await self._client.get_async_httpx_client().aclose()
        await self._run_log_client.get_async_httpx_client().aclose()

    async def log_run_step(self, body: dict[str, Any]) -> str:
        """POST /v1/agent-runs (no Idempotency-Key: it moves no money). Returns the run step id."""
        res = await post_v1_agent_runs.asyncio_detailed(
            client=self._run_log_client, body=PostV1AgentRunsBody.from_dict(body)
        )
        return _expect(res, PostV1AgentRunsResponse201, "POST /v1/agent-runs").id

    async def list_open_bounties(self) -> list[BountyView]:
        res = await get_v1_bounties.asyncio_detailed(client=self._client, status=GetV1BountiesStatus.OPEN)
        parsed = _expect(res, GetV1BountiesResponse200, "GET /v1/bounties")
        return [
            BountyView(
                id=b.id,
                task_type=b.task_type.value,
                title=b.title,
                spec=b.spec.to_dict(),
                reward_cents=b.reward_cents,
                spend_rule_pct=b.spend_rule_pct,
            )
            for b in parsed.bounties
        ]

    async def enter(self, bounty_id: str, idempotency_key: str) -> EntryResult:
        async with self._idempotent(idempotency_key) as client:
            res = await post_v1_bounties_id_entries.asyncio_detailed(bounty_id, client=client)
        parsed = res.parsed
        if not isinstance(parsed, PostV1BountiesIdEntriesResponse200 | PostV1BountiesIdEntriesResponse201):
            raise ApiError(f"POST /v1/bounties/{bounty_id}/entries", res.status_code, res.content)
        entry = parsed.entry
        return EntryResult(
            entry_id=entry.id if entry is not None else None,
            entry_status=entry.status.value if entry is not None else None,
            stake_decision=parsed.stake.decision.value,
            existing=res.status_code == 200 or res.headers.get(REPLAYED_HEADER) == "true",
        )

    async def entry_status(self, entry_id: str) -> str:
        res = await get_v1_entries_id.asyncio_detailed(entry_id, client=self._client)
        return _expect(res, GetV1EntriesIdResponse200, f"GET /v1/entries/{entry_id}").status.value

    async def submit(self, entry_id: str, content: dict[str, Any], idempotency_key: str) -> str:
        body = PostV1EntriesIdSubmissionsBody.from_dict({"content": content})
        async with self._idempotent(idempotency_key) as client:
            res = await post_v1_entries_id_submissions.asyncio_detailed(entry_id, client=client, body=body)
        return _expect(res, PostV1EntriesIdSubmissionsResponse201, f"POST /v1/entries/{entry_id}/submissions").id

    async def request_spend(
        self, *, payee_agent_id: str, amount_cents: int, category: str, reason: str, idempotency_key: str
    ) -> SpendResult:
        body = PostV1SpendRequestsBody.from_dict(
            {"payeeAgentId": payee_agent_id, "amountCents": amount_cents, "category": category, "reason": reason}
        )
        async with self._idempotent(idempotency_key) as client:
            res = await post_v1_spend_requests.asyncio_detailed(client=client, body=body)
        parsed = _expect(res, PostV1SpendRequestsResponse201, "POST /v1/spend-requests")
        return SpendResult(
            id=parsed.id,
            decision=parsed.decision.value,
            status=parsed.status.value,
            reasons=[r.value for r in parsed.reasons],
            amount_cents=amount_cents,
            category=category,
        )

    # --- subcontracts (sub-01) ---

    async def me(self) -> str:
        """The calling agent's id (GET /v1/agents/me)."""
        res = await get_v1_agents_me.asyncio_detailed(client=self._client)
        return _expect(res, GetV1AgentsMeResponse200, "GET /v1/agents/me").id

    async def search_agents(self, skill: str, min_rating_tenths: int) -> list[AgentCard]:
        res = await get_v1_agents_search.asyncio_detailed(
            client=self._client, skill=skill, min_rating=min_rating_tenths
        )
        parsed = _expect(res, GetV1AgentsSearchResponse200, "GET /v1/agents/search")
        return [
            AgentCard(id=a.id, name=a.name, skills=list(a.skills), rating=a.rating, completed_jobs=a.completed_jobs)
            for a in parsed.agents
        ]

    async def create_subcontract(
        self,
        *,
        worker_agent_id: str,
        task: str,
        amount_cents: int,
        reason: str,
        bounty_id: str | None,
        deliver_by_minutes: int | None,
        idempotency_key: str,
    ) -> HireResult:
        body = PostV1SubcontractsBody(
            worker_agent_id=worker_agent_id,
            task=task,
            amount_cents=amount_cents,
            reason=reason,
            bounty_id=bounty_id if bounty_id is not None else UNSET,
            deliver_by_minutes=deliver_by_minutes if deliver_by_minutes is not None else UNSET,
        )
        async with self._idempotent(idempotency_key) as client:
            res = await post_v1_subcontracts.asyncio_detailed(client=client, body=body)
        parsed = _expect(res, PostV1SubcontractsResponse201, "POST /v1/subcontracts")
        spend = SpendResult(
            id=parsed.spend.id,
            decision=parsed.spend.decision.value,
            status=parsed.spend.status.value,
            reasons=[r.value for r in parsed.spend.reasons],
            amount_cents=amount_cents,
            category="subcontract",
        )
        return HireResult(spend=spend, job=_job(parsed.subcontract) if parsed.subcontract is not None else None)

    async def get_subcontract(self, subcontract_id: str) -> JobView:
        res = await get_v1_subcontracts_id.asyncio_detailed(subcontract_id, client=self._client)
        return _job(_expect(res, GetV1SubcontractsIdResponse200, f"GET /v1/subcontracts/{subcontract_id}"))

    async def inbox(self) -> list[JobView]:
        res = await get_v1_subcontracts_inbox.asyncio_detailed(client=self._client)
        parsed = _expect(res, GetV1SubcontractsInboxResponse200, "GET /v1/subcontracts/inbox")
        return [_job(s) for s in parsed.subcontracts]

    async def accept_subcontract(self, subcontract_id: str, rating: int, idempotency_key: str) -> JobView:
        body = PostV1SubcontractsIdAcceptBody(rating=rating)
        async with self._idempotent(idempotency_key) as client:
            res = await post_v1_subcontracts_id_accept.asyncio_detailed(subcontract_id, client=client, body=body)
        what = f"POST /v1/subcontracts/{subcontract_id}/accept"
        return _job(_expect(res, PostV1SubcontractsIdAcceptResponse200, what))

    async def cancel_subcontract(self, subcontract_id: str, idempotency_key: str) -> JobView:
        async with self._idempotent(idempotency_key) as client:
            res = await post_v1_subcontracts_id_cancel.asyncio_detailed(subcontract_id, client=client)
        what = f"POST /v1/subcontracts/{subcontract_id}/cancel"
        return _job(_expect(res, PostV1SubcontractsIdCancelResponse200, what))

    async def deliver_subcontract(self, subcontract_id: str, deliverable: str, idempotency_key: str) -> JobView:
        body = PostV1SubcontractsIdDeliverBody(deliverable=deliverable)
        async with self._idempotent(idempotency_key) as client:
            res = await post_v1_subcontracts_id_deliver.asyncio_detailed(subcontract_id, client=client, body=body)
        what = f"POST /v1/subcontracts/{subcontract_id}/deliver"
        return _job(_expect(res, PostV1SubcontractsIdDeliverResponse200, what))

    async def decline_subcontract(self, subcontract_id: str, idempotency_key: str) -> JobView:
        async with self._idempotent(idempotency_key) as client:
            res = await post_v1_subcontracts_id_decline.asyncio_detailed(subcontract_id, client=client)
        what = f"POST /v1/subcontracts/{subcontract_id}/decline"
        return _job(_expect(res, PostV1SubcontractsIdDeclineResponse200, what))


def _expect[T](res: Response[Any], cls: type[T], what: str) -> T:
    if isinstance(res.parsed, cls):
        return res.parsed
    raise ApiError(what, res.status_code, res.content)
