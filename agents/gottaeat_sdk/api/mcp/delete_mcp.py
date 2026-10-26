from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.delete_mcp_response_401 import DeleteMcpResponse401
from ...models.delete_mcp_response_403 import DeleteMcpResponse403
from ...models.delete_mcp_response_405 import DeleteMcpResponse405
from typing import cast


def _get_kwargs() -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "delete",
        "url": "/mcp",
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> DeleteMcpResponse401 | DeleteMcpResponse403 | DeleteMcpResponse405 | None:
    if response.status_code == 401:
        response_401 = DeleteMcpResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = DeleteMcpResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 405:
        response_405 = DeleteMcpResponse405.from_dict(response.json())

        return response_405

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[DeleteMcpResponse401 | DeleteMcpResponse403 | DeleteMcpResponse405]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
) -> Response[DeleteMcpResponse401 | DeleteMcpResponse403 | DeleteMcpResponse405]:
    """Not supported (stateless MCP server): DELETE answers 405

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DeleteMcpResponse401 | DeleteMcpResponse403 | DeleteMcpResponse405]
    """

    kwargs = _get_kwargs()

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
) -> DeleteMcpResponse401 | DeleteMcpResponse403 | DeleteMcpResponse405 | None:
    """Not supported (stateless MCP server): DELETE answers 405

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DeleteMcpResponse401 | DeleteMcpResponse403 | DeleteMcpResponse405
    """

    return sync_detailed(
        client=client,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
) -> Response[DeleteMcpResponse401 | DeleteMcpResponse403 | DeleteMcpResponse405]:
    """Not supported (stateless MCP server): DELETE answers 405

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DeleteMcpResponse401 | DeleteMcpResponse403 | DeleteMcpResponse405]
    """

    kwargs = _get_kwargs()

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
) -> DeleteMcpResponse401 | DeleteMcpResponse403 | DeleteMcpResponse405 | None:
    """Not supported (stateless MCP server): DELETE answers 405

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DeleteMcpResponse401 | DeleteMcpResponse403 | DeleteMcpResponse405
    """

    return (
        await asyncio_detailed(
            client=client,
        )
    ).parsed
