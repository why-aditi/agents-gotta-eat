from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.get_v1_agents_id_spend_requests_response_200 import GetV1AgentsIdSpendRequestsResponse200
from ...models.get_v1_agents_id_spend_requests_response_400 import GetV1AgentsIdSpendRequestsResponse400
from ...models.get_v1_agents_id_spend_requests_response_401 import GetV1AgentsIdSpendRequestsResponse401
from ...models.get_v1_agents_id_spend_requests_response_403 import GetV1AgentsIdSpendRequestsResponse403
from ...models.get_v1_agents_id_spend_requests_response_404 import GetV1AgentsIdSpendRequestsResponse404
from typing import cast


def _get_kwargs(
    id: str,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/agents/{id}/spend-requests".format(
            id=quote(str(id), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    GetV1AgentsIdSpendRequestsResponse200
    | GetV1AgentsIdSpendRequestsResponse400
    | GetV1AgentsIdSpendRequestsResponse401
    | GetV1AgentsIdSpendRequestsResponse403
    | GetV1AgentsIdSpendRequestsResponse404
    | None
):
    if response.status_code == 200:
        response_200 = GetV1AgentsIdSpendRequestsResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = GetV1AgentsIdSpendRequestsResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = GetV1AgentsIdSpendRequestsResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = GetV1AgentsIdSpendRequestsResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = GetV1AgentsIdSpendRequestsResponse404.from_dict(response.json())

        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    GetV1AgentsIdSpendRequestsResponse200
    | GetV1AgentsIdSpendRequestsResponse400
    | GetV1AgentsIdSpendRequestsResponse401
    | GetV1AgentsIdSpendRequestsResponse403
    | GetV1AgentsIdSpendRequestsResponse404
]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: str,
    *,
    client: AuthenticatedClient,
) -> Response[
    GetV1AgentsIdSpendRequestsResponse200
    | GetV1AgentsIdSpendRequestsResponse400
    | GetV1AgentsIdSpendRequestsResponse401
    | GetV1AgentsIdSpendRequestsResponse403
    | GetV1AgentsIdSpendRequestsResponse404
]:
    """An agent's spend requests, newest first (at most 100)

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1AgentsIdSpendRequestsResponse200 | GetV1AgentsIdSpendRequestsResponse400 | GetV1AgentsIdSpendRequestsResponse401 | GetV1AgentsIdSpendRequestsResponse403 | GetV1AgentsIdSpendRequestsResponse404]
    """

    kwargs = _get_kwargs(
        id=id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    id: str,
    *,
    client: AuthenticatedClient,
) -> (
    GetV1AgentsIdSpendRequestsResponse200
    | GetV1AgentsIdSpendRequestsResponse400
    | GetV1AgentsIdSpendRequestsResponse401
    | GetV1AgentsIdSpendRequestsResponse403
    | GetV1AgentsIdSpendRequestsResponse404
    | None
):
    """An agent's spend requests, newest first (at most 100)

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1AgentsIdSpendRequestsResponse200 | GetV1AgentsIdSpendRequestsResponse400 | GetV1AgentsIdSpendRequestsResponse401 | GetV1AgentsIdSpendRequestsResponse403 | GetV1AgentsIdSpendRequestsResponse404
    """

    return sync_detailed(
        id=id,
        client=client,
    ).parsed


async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient,
) -> Response[
    GetV1AgentsIdSpendRequestsResponse200
    | GetV1AgentsIdSpendRequestsResponse400
    | GetV1AgentsIdSpendRequestsResponse401
    | GetV1AgentsIdSpendRequestsResponse403
    | GetV1AgentsIdSpendRequestsResponse404
]:
    """An agent's spend requests, newest first (at most 100)

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1AgentsIdSpendRequestsResponse200 | GetV1AgentsIdSpendRequestsResponse400 | GetV1AgentsIdSpendRequestsResponse401 | GetV1AgentsIdSpendRequestsResponse403 | GetV1AgentsIdSpendRequestsResponse404]
    """

    kwargs = _get_kwargs(
        id=id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient,
) -> (
    GetV1AgentsIdSpendRequestsResponse200
    | GetV1AgentsIdSpendRequestsResponse400
    | GetV1AgentsIdSpendRequestsResponse401
    | GetV1AgentsIdSpendRequestsResponse403
    | GetV1AgentsIdSpendRequestsResponse404
    | None
):
    """An agent's spend requests, newest first (at most 100)

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1AgentsIdSpendRequestsResponse200 | GetV1AgentsIdSpendRequestsResponse400 | GetV1AgentsIdSpendRequestsResponse401 | GetV1AgentsIdSpendRequestsResponse403 | GetV1AgentsIdSpendRequestsResponse404
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
        )
    ).parsed
