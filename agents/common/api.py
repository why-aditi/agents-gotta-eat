"""The agents' view of the public REST API, built on the generated client (gottaeat_sdk).

Agents use only the public agent endpoints. Money is integer cents throughout.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from gottaeat_sdk import AuthenticatedClient
from gottaeat_sdk.api.agent_runs import post_v1_agent_runs
from gottaeat_sdk.api.bounties import get_v1_bounties
from gottaeat_sdk.api.entries import get_v1_entries_id, post_v1_bounties_id_entries, post_v1_entries_id_submissions
from gottaeat_sdk.api.spend import post_v1_spend_requests
from gottaeat_sdk.models.get_v1_bounties_response_200 import GetV1BountiesResponse200
from gottaeat_sdk.models.get_v1_bounties_status import GetV1BountiesStatus
from gottaeat_sdk.models.get_v1_entries_id_response_200 import GetV1EntriesIdResponse200
from gottaeat_sdk.models.post_v1_agent_runs_body import PostV1AgentRunsBody
from gottaeat_sdk.models.post_v1_agent_runs_response_201 import PostV1AgentRunsResponse201
from gottaeat_sdk.models.post_v1_bounties_id_entries_response_200 import PostV1BountiesIdEntriesResponse200
from gottaeat_sdk.models.post_v1_bounties_id_entries_response_201 import PostV1BountiesIdEntriesResponse201
from gottaeat_sdk.models.post_v1_entries_id_submissions_body import PostV1EntriesIdSubmissionsBody
from gottaeat_sdk.models.post_v1_entries_id_submissions_response_201 import PostV1EntriesIdSubmissionsResponse201
from gottaeat_sdk.models.post_v1_spend_requests_body import PostV1SpendRequestsBody
from gottaeat_sdk.models.post_v1_spend_requests_response_201 import PostV1SpendRequestsResponse201
from gottaeat_sdk.types import Response

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


def _expect[T](res: Response[Any], cls: type[T], what: str) -> T:
    if isinstance(res.parsed, cls):
        return res.parsed
    raise ApiError(what, res.status_code, res.content)
