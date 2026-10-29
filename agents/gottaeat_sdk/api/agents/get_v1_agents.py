from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.get_v1_agents_response_200 import GetV1AgentsResponse200
from ...models.get_v1_agents_response_401 import GetV1AgentsResponse401
from ...models.get_v1_agents_response_403 import GetV1AgentsResponse403
from typing import cast


def _get_kwargs() -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/agents",
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GetV1AgentsResponse200 | GetV1AgentsResponse401 | GetV1AgentsResponse403 | None:
    if response.status_code == 200:
        response_200 = GetV1AgentsResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 401:
        response_401 = GetV1AgentsResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = GetV1AgentsResponse403.from_dict(response.json())

        return response_403

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[GetV1AgentsResponse200 | GetV1AgentsResponse401 | GetV1AgentsResponse403]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
) -> Response[GetV1AgentsResponse200 | GetV1AgentsResponse401 | GetV1AgentsResponse403]:
    """List the caller's agents, newest first

     Each agent carries `today`: its spend since 00:00 UTC as the daily cap counts it, and its confirmed
    mandate's daily cap (null without one).

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1AgentsResponse200 | GetV1AgentsResponse401 | GetV1AgentsResponse403]
    """

    kwargs = _get_kwargs()

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
) -> GetV1AgentsResponse200 | GetV1AgentsResponse401 | GetV1AgentsResponse403 | None:
    """List the caller's agents, newest first

     Each agent carries `today`: its spend since 00:00 UTC as the daily cap counts it, and its confirmed
    mandate's daily cap (null without one).

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1AgentsResponse200 | GetV1AgentsResponse401 | GetV1AgentsResponse403
    """

    return sync_detailed(
        client=client,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
) -> Response[GetV1AgentsResponse200 | GetV1AgentsResponse401 | GetV1AgentsResponse403]:
    """List the caller's agents, newest first

     Each agent carries `today`: its spend since 00:00 UTC as the daily cap counts it, and its confirmed
    mandate's daily cap (null without one).

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1AgentsResponse200 | GetV1AgentsResponse401 | GetV1AgentsResponse403]
    """

    kwargs = _get_kwargs()

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
) -> GetV1AgentsResponse200 | GetV1AgentsResponse401 | GetV1AgentsResponse403 | None:
    """List the caller's agents, newest first

     Each agent carries `today`: its spend since 00:00 UTC as the daily cap counts it, and its confirmed
    mandate's daily cap (null without one).

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1AgentsResponse200 | GetV1AgentsResponse401 | GetV1AgentsResponse403
    """

    return (
        await asyncio_detailed(
            client=client,
        )
    ).parsed
