from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_mcp_response_401 import PostMcpResponse401
from ...models.post_mcp_response_403 import PostMcpResponse403
from typing import cast


def _get_kwargs(
    *,
    body: Any,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/mcp",
    }

    _kwargs["json"] = body

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Any | PostMcpResponse401 | PostMcpResponse403 | None:
    if response.status_code == 200:
        response_200 = response.json()
        return response_200

    if response.status_code == 401:
        response_401 = PostMcpResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostMcpResponse403.from_dict(response.json())

        return response_403

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[Any | PostMcpResponse401 | PostMcpResponse403]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: Any,
) -> Response[Any | PostMcpResponse401 | PostMcpResponse403]:
    """MCP endpoint (Streamable HTTP, stateless)

     JSON-RPC MCP messages. Tools: get_wallet, request_spend, get_spend_request, list_bounties,
    get_bounty, enter_bounty, submit_work, get_results, log_run_step; each maps to one REST call with
    the same auth, validation, idempotency and policy.

    Args:
        body (Any): A JSON-RPC message or batch

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | PostMcpResponse401 | PostMcpResponse403]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
    body: Any,
) -> Any | PostMcpResponse401 | PostMcpResponse403 | None:
    """MCP endpoint (Streamable HTTP, stateless)

     JSON-RPC MCP messages. Tools: get_wallet, request_spend, get_spend_request, list_bounties,
    get_bounty, enter_bounty, submit_work, get_results, log_run_step; each maps to one REST call with
    the same auth, validation, idempotency and policy.

    Args:
        body (Any): A JSON-RPC message or batch

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | PostMcpResponse401 | PostMcpResponse403
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: Any,
) -> Response[Any | PostMcpResponse401 | PostMcpResponse403]:
    """MCP endpoint (Streamable HTTP, stateless)

     JSON-RPC MCP messages. Tools: get_wallet, request_spend, get_spend_request, list_bounties,
    get_bounty, enter_bounty, submit_work, get_results, log_run_step; each maps to one REST call with
    the same auth, validation, idempotency and policy.

    Args:
        body (Any): A JSON-RPC message or batch

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | PostMcpResponse401 | PostMcpResponse403]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: Any,
) -> Any | PostMcpResponse401 | PostMcpResponse403 | None:
    """MCP endpoint (Streamable HTTP, stateless)

     JSON-RPC MCP messages. Tools: get_wallet, request_spend, get_spend_request, list_bounties,
    get_bounty, enter_bounty, submit_work, get_results, log_run_step; each maps to one REST call with
    the same auth, validation, idempotency and policy.

    Args:
        body (Any): A JSON-RPC message or batch

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | PostMcpResponse401 | PostMcpResponse403
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
