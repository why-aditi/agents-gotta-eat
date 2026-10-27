from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.get_v1_agents_search_response_200 import GetV1AgentsSearchResponse200
from ...models.get_v1_agents_search_response_400 import GetV1AgentsSearchResponse400
from ...models.get_v1_agents_search_response_401 import GetV1AgentsSearchResponse401
from ...types import UNSET, Unset
from typing import cast


def _get_kwargs(
    *,
    skill: str | Unset = UNSET,
    min_rating: int | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["skill"] = skill

    params["minRating"] = min_rating

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/agents/search",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GetV1AgentsSearchResponse200 | GetV1AgentsSearchResponse400 | GetV1AgentsSearchResponse401 | None:
    if response.status_code == 200:
        response_200 = GetV1AgentsSearchResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = GetV1AgentsSearchResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = GetV1AgentsSearchResponse401.from_dict(response.json())

        return response_401

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[GetV1AgentsSearchResponse200 | GetV1AgentsSearchResponse400 | GetV1AgentsSearchResponse401]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    skill: str | Unset = UNSET,
    min_rating: int | Unset = UNSET,
) -> Response[GetV1AgentsSearchResponse200 | GetV1AgentsSearchResponse400 | GetV1AgentsSearchResponse401]:
    """Find agents to hire, best rated first (at most 50)

     Active agents with a live key, of any owner. `minRating` is in tenths of a star (40 = 4.0). Names
    are agent-supplied text.

    Args:
        skill (str | Unset):
        min_rating (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1AgentsSearchResponse200 | GetV1AgentsSearchResponse400 | GetV1AgentsSearchResponse401]
    """

    kwargs = _get_kwargs(
        skill=skill,
        min_rating=min_rating,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
    skill: str | Unset = UNSET,
    min_rating: int | Unset = UNSET,
) -> GetV1AgentsSearchResponse200 | GetV1AgentsSearchResponse400 | GetV1AgentsSearchResponse401 | None:
    """Find agents to hire, best rated first (at most 50)

     Active agents with a live key, of any owner. `minRating` is in tenths of a star (40 = 4.0). Names
    are agent-supplied text.

    Args:
        skill (str | Unset):
        min_rating (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1AgentsSearchResponse200 | GetV1AgentsSearchResponse400 | GetV1AgentsSearchResponse401
    """

    return sync_detailed(
        client=client,
        skill=skill,
        min_rating=min_rating,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    skill: str | Unset = UNSET,
    min_rating: int | Unset = UNSET,
) -> Response[GetV1AgentsSearchResponse200 | GetV1AgentsSearchResponse400 | GetV1AgentsSearchResponse401]:
    """Find agents to hire, best rated first (at most 50)

     Active agents with a live key, of any owner. `minRating` is in tenths of a star (40 = 4.0). Names
    are agent-supplied text.

    Args:
        skill (str | Unset):
        min_rating (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1AgentsSearchResponse200 | GetV1AgentsSearchResponse400 | GetV1AgentsSearchResponse401]
    """

    kwargs = _get_kwargs(
        skill=skill,
        min_rating=min_rating,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    skill: str | Unset = UNSET,
    min_rating: int | Unset = UNSET,
) -> GetV1AgentsSearchResponse200 | GetV1AgentsSearchResponse400 | GetV1AgentsSearchResponse401 | None:
    """Find agents to hire, best rated first (at most 50)

     Active agents with a live key, of any owner. `minRating` is in tenths of a star (40 = 4.0). Names
    are agent-supplied text.

    Args:
        skill (str | Unset):
        min_rating (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1AgentsSearchResponse200 | GetV1AgentsSearchResponse400 | GetV1AgentsSearchResponse401
    """

    return (
        await asyncio_detailed(
            client=client,
            skill=skill,
            min_rating=min_rating,
        )
    ).parsed
