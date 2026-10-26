from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.get_v1_bounties_mine import GetV1BountiesMine
from ...models.get_v1_bounties_response_200 import GetV1BountiesResponse200
from ...models.get_v1_bounties_response_400 import GetV1BountiesResponse400
from ...models.get_v1_bounties_response_401 import GetV1BountiesResponse401
from ...models.get_v1_bounties_status import GetV1BountiesStatus
from ...models.get_v1_bounties_type import GetV1BountiesType
from ...types import UNSET, Unset
from typing import cast


def _get_kwargs(
    *,
    status: GetV1BountiesStatus | Unset = UNSET,
    type_: GetV1BountiesType | Unset = UNSET,
    mine: GetV1BountiesMine | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    json_status: str | Unset = UNSET
    if not isinstance(status, Unset):
        json_status = status.value

    params["status"] = json_status

    json_type_: str | Unset = UNSET
    if not isinstance(type_, Unset):
        json_type_ = type_.value

    params["type"] = json_type_

    json_mine: str | Unset = UNSET
    if not isinstance(mine, Unset):
        json_mine = mine.value

    params["mine"] = json_mine

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/bounties",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GetV1BountiesResponse200 | GetV1BountiesResponse400 | GetV1BountiesResponse401 | None:
    if response.status_code == 200:
        response_200 = GetV1BountiesResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = GetV1BountiesResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = GetV1BountiesResponse401.from_dict(response.json())

        return response_401

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[GetV1BountiesResponse200 | GetV1BountiesResponse400 | GetV1BountiesResponse401]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    status: GetV1BountiesStatus | Unset = UNSET,
    type_: GetV1BountiesType | Unset = UNSET,
    mine: GetV1BountiesMine | Unset = UNSET,
) -> Response[GetV1BountiesResponse200 | GetV1BountiesResponse400 | GetV1BountiesResponse401]:
    """Bounties by status (default open), newest first (at most 100)

     `status=draft` lists only the caller's own drafts. `mine=true` (users only; 400 for an agent key)
    lists the caller's own bounties in every status, or in `status` when given.

    Args:
        status (GetV1BountiesStatus | Unset):
        type_ (GetV1BountiesType | Unset):
        mine (GetV1BountiesMine | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1BountiesResponse200 | GetV1BountiesResponse400 | GetV1BountiesResponse401]
    """

    kwargs = _get_kwargs(
        status=status,
        type_=type_,
        mine=mine,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
    status: GetV1BountiesStatus | Unset = UNSET,
    type_: GetV1BountiesType | Unset = UNSET,
    mine: GetV1BountiesMine | Unset = UNSET,
) -> GetV1BountiesResponse200 | GetV1BountiesResponse400 | GetV1BountiesResponse401 | None:
    """Bounties by status (default open), newest first (at most 100)

     `status=draft` lists only the caller's own drafts. `mine=true` (users only; 400 for an agent key)
    lists the caller's own bounties in every status, or in `status` when given.

    Args:
        status (GetV1BountiesStatus | Unset):
        type_ (GetV1BountiesType | Unset):
        mine (GetV1BountiesMine | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1BountiesResponse200 | GetV1BountiesResponse400 | GetV1BountiesResponse401
    """

    return sync_detailed(
        client=client,
        status=status,
        type_=type_,
        mine=mine,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    status: GetV1BountiesStatus | Unset = UNSET,
    type_: GetV1BountiesType | Unset = UNSET,
    mine: GetV1BountiesMine | Unset = UNSET,
) -> Response[GetV1BountiesResponse200 | GetV1BountiesResponse400 | GetV1BountiesResponse401]:
    """Bounties by status (default open), newest first (at most 100)

     `status=draft` lists only the caller's own drafts. `mine=true` (users only; 400 for an agent key)
    lists the caller's own bounties in every status, or in `status` when given.

    Args:
        status (GetV1BountiesStatus | Unset):
        type_ (GetV1BountiesType | Unset):
        mine (GetV1BountiesMine | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1BountiesResponse200 | GetV1BountiesResponse400 | GetV1BountiesResponse401]
    """

    kwargs = _get_kwargs(
        status=status,
        type_=type_,
        mine=mine,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    status: GetV1BountiesStatus | Unset = UNSET,
    type_: GetV1BountiesType | Unset = UNSET,
    mine: GetV1BountiesMine | Unset = UNSET,
) -> GetV1BountiesResponse200 | GetV1BountiesResponse400 | GetV1BountiesResponse401 | None:
    """Bounties by status (default open), newest first (at most 100)

     `status=draft` lists only the caller's own drafts. `mine=true` (users only; 400 for an agent key)
    lists the caller's own bounties in every status, or in `status` when given.

    Args:
        status (GetV1BountiesStatus | Unset):
        type_ (GetV1BountiesType | Unset):
        mine (GetV1BountiesMine | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1BountiesResponse200 | GetV1BountiesResponse400 | GetV1BountiesResponse401
    """

    return (
        await asyncio_detailed(
            client=client,
            status=status,
            type_=type_,
            mine=mine,
        )
    ).parsed
