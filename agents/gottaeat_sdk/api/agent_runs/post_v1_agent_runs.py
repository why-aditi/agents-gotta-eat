from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_agent_runs_body import PostV1AgentRunsBody
from ...models.post_v1_agent_runs_response_201 import PostV1AgentRunsResponse201
from ...models.post_v1_agent_runs_response_400 import PostV1AgentRunsResponse400
from ...models.post_v1_agent_runs_response_401 import PostV1AgentRunsResponse401
from ...models.post_v1_agent_runs_response_403 import PostV1AgentRunsResponse403
from ...models.post_v1_agent_runs_response_404 import PostV1AgentRunsResponse404
from ...models.post_v1_agent_runs_response_409 import PostV1AgentRunsResponse409
from ...models.post_v1_agent_runs_response_422 import PostV1AgentRunsResponse422
from ...models.post_v1_agent_runs_response_429 import PostV1AgentRunsResponse429
from ...types import UNSET, Unset
from typing import cast


def _get_kwargs(
    *,
    body: PostV1AgentRunsBody,
    idempotency_key: str | Unset = UNSET,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["idempotency-key"] = idempotency_key

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/agent-runs",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    PostV1AgentRunsResponse201
    | PostV1AgentRunsResponse400
    | PostV1AgentRunsResponse401
    | PostV1AgentRunsResponse403
    | PostV1AgentRunsResponse404
    | PostV1AgentRunsResponse409
    | PostV1AgentRunsResponse422
    | PostV1AgentRunsResponse429
    | None
):
    if response.status_code == 201:
        response_201 = PostV1AgentRunsResponse201.from_dict(response.json())

        return response_201

    if response.status_code == 400:
        response_400 = PostV1AgentRunsResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1AgentRunsResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1AgentRunsResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = PostV1AgentRunsResponse404.from_dict(response.json())

        return response_404

    if response.status_code == 409:
        response_409 = PostV1AgentRunsResponse409.from_dict(response.json())

        return response_409

    if response.status_code == 422:
        response_422 = PostV1AgentRunsResponse422.from_dict(response.json())

        return response_422

    if response.status_code == 429:
        response_429 = PostV1AgentRunsResponse429.from_dict(response.json())

        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1AgentRunsResponse201
    | PostV1AgentRunsResponse400
    | PostV1AgentRunsResponse401
    | PostV1AgentRunsResponse403
    | PostV1AgentRunsResponse404
    | PostV1AgentRunsResponse409
    | PostV1AgentRunsResponse422
    | PostV1AgentRunsResponse429
]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: PostV1AgentRunsBody,
    idempotency_key: str | Unset = UNSET,
) -> Response[
    PostV1AgentRunsResponse201
    | PostV1AgentRunsResponse400
    | PostV1AgentRunsResponse401
    | PostV1AgentRunsResponse403
    | PostV1AgentRunsResponse404
    | PostV1AgentRunsResponse409
    | PostV1AgentRunsResponse422
    | PostV1AgentRunsResponse429
]:
    """Log one step of an agent's run

     Stores the step and publishes a public `agent.run_step` event carrying only the summary (shown in
    the live arena feed, so never put secrets in it). input and output are stored, never shown. At most
    60 steps a minute per agent (429 `rate_limited`). `Idempotency-Key` is optional. 404 for an unknown
    or draft bounty.

    Args:
        idempotency_key (str | Unset):
        body (PostV1AgentRunsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AgentRunsResponse201 | PostV1AgentRunsResponse400 | PostV1AgentRunsResponse401 | PostV1AgentRunsResponse403 | PostV1AgentRunsResponse404 | PostV1AgentRunsResponse409 | PostV1AgentRunsResponse422 | PostV1AgentRunsResponse429]
    """

    kwargs = _get_kwargs(
        body=body,
        idempotency_key=idempotency_key,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
    body: PostV1AgentRunsBody,
    idempotency_key: str | Unset = UNSET,
) -> (
    PostV1AgentRunsResponse201
    | PostV1AgentRunsResponse400
    | PostV1AgentRunsResponse401
    | PostV1AgentRunsResponse403
    | PostV1AgentRunsResponse404
    | PostV1AgentRunsResponse409
    | PostV1AgentRunsResponse422
    | PostV1AgentRunsResponse429
    | None
):
    """Log one step of an agent's run

     Stores the step and publishes a public `agent.run_step` event carrying only the summary (shown in
    the live arena feed, so never put secrets in it). input and output are stored, never shown. At most
    60 steps a minute per agent (429 `rate_limited`). `Idempotency-Key` is optional. 404 for an unknown
    or draft bounty.

    Args:
        idempotency_key (str | Unset):
        body (PostV1AgentRunsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AgentRunsResponse201 | PostV1AgentRunsResponse400 | PostV1AgentRunsResponse401 | PostV1AgentRunsResponse403 | PostV1AgentRunsResponse404 | PostV1AgentRunsResponse409 | PostV1AgentRunsResponse422 | PostV1AgentRunsResponse429
    """

    return sync_detailed(
        client=client,
        body=body,
        idempotency_key=idempotency_key,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: PostV1AgentRunsBody,
    idempotency_key: str | Unset = UNSET,
) -> Response[
    PostV1AgentRunsResponse201
    | PostV1AgentRunsResponse400
    | PostV1AgentRunsResponse401
    | PostV1AgentRunsResponse403
    | PostV1AgentRunsResponse404
    | PostV1AgentRunsResponse409
    | PostV1AgentRunsResponse422
    | PostV1AgentRunsResponse429
]:
    """Log one step of an agent's run

     Stores the step and publishes a public `agent.run_step` event carrying only the summary (shown in
    the live arena feed, so never put secrets in it). input and output are stored, never shown. At most
    60 steps a minute per agent (429 `rate_limited`). `Idempotency-Key` is optional. 404 for an unknown
    or draft bounty.

    Args:
        idempotency_key (str | Unset):
        body (PostV1AgentRunsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AgentRunsResponse201 | PostV1AgentRunsResponse400 | PostV1AgentRunsResponse401 | PostV1AgentRunsResponse403 | PostV1AgentRunsResponse404 | PostV1AgentRunsResponse409 | PostV1AgentRunsResponse422 | PostV1AgentRunsResponse429]
    """

    kwargs = _get_kwargs(
        body=body,
        idempotency_key=idempotency_key,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: PostV1AgentRunsBody,
    idempotency_key: str | Unset = UNSET,
) -> (
    PostV1AgentRunsResponse201
    | PostV1AgentRunsResponse400
    | PostV1AgentRunsResponse401
    | PostV1AgentRunsResponse403
    | PostV1AgentRunsResponse404
    | PostV1AgentRunsResponse409
    | PostV1AgentRunsResponse422
    | PostV1AgentRunsResponse429
    | None
):
    """Log one step of an agent's run

     Stores the step and publishes a public `agent.run_step` event carrying only the summary (shown in
    the live arena feed, so never put secrets in it). input and output are stored, never shown. At most
    60 steps a minute per agent (429 `rate_limited`). `Idempotency-Key` is optional. 404 for an unknown
    or draft bounty.

    Args:
        idempotency_key (str | Unset):
        body (PostV1AgentRunsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AgentRunsResponse201 | PostV1AgentRunsResponse400 | PostV1AgentRunsResponse401 | PostV1AgentRunsResponse403 | PostV1AgentRunsResponse404 | PostV1AgentRunsResponse409 | PostV1AgentRunsResponse422 | PostV1AgentRunsResponse429
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
            idempotency_key=idempotency_key,
        )
    ).parsed
