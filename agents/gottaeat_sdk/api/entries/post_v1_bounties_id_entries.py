from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_bounties_id_entries_response_200 import PostV1BountiesIdEntriesResponse200
from ...models.post_v1_bounties_id_entries_response_201 import PostV1BountiesIdEntriesResponse201
from ...models.post_v1_bounties_id_entries_response_400 import PostV1BountiesIdEntriesResponse400
from ...models.post_v1_bounties_id_entries_response_401 import PostV1BountiesIdEntriesResponse401
from ...models.post_v1_bounties_id_entries_response_403 import PostV1BountiesIdEntriesResponse403
from ...models.post_v1_bounties_id_entries_response_404 import PostV1BountiesIdEntriesResponse404
from ...models.post_v1_bounties_id_entries_response_409 import PostV1BountiesIdEntriesResponse409
from ...models.post_v1_bounties_id_entries_response_422 import PostV1BountiesIdEntriesResponse422
from typing import cast


def _get_kwargs(
    id: str,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/bounties/{id}/entries".format(
            id=quote(str(id), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    PostV1BountiesIdEntriesResponse200
    | PostV1BountiesIdEntriesResponse201
    | PostV1BountiesIdEntriesResponse400
    | PostV1BountiesIdEntriesResponse401
    | PostV1BountiesIdEntriesResponse403
    | PostV1BountiesIdEntriesResponse404
    | PostV1BountiesIdEntriesResponse409
    | PostV1BountiesIdEntriesResponse422
    | None
):
    if response.status_code == 200:
        response_200 = PostV1BountiesIdEntriesResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 201:
        response_201 = PostV1BountiesIdEntriesResponse201.from_dict(response.json())

        return response_201

    if response.status_code == 400:
        response_400 = PostV1BountiesIdEntriesResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1BountiesIdEntriesResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1BountiesIdEntriesResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = PostV1BountiesIdEntriesResponse404.from_dict(response.json())

        return response_404

    if response.status_code == 409:
        response_409 = PostV1BountiesIdEntriesResponse409.from_dict(response.json())

        return response_409

    if response.status_code == 422:
        response_422 = PostV1BountiesIdEntriesResponse422.from_dict(response.json())

        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1BountiesIdEntriesResponse200
    | PostV1BountiesIdEntriesResponse201
    | PostV1BountiesIdEntriesResponse400
    | PostV1BountiesIdEntriesResponse401
    | PostV1BountiesIdEntriesResponse403
    | PostV1BountiesIdEntriesResponse404
    | PostV1BountiesIdEntriesResponse409
    | PostV1BountiesIdEntriesResponse422
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
    PostV1BountiesIdEntriesResponse200
    | PostV1BountiesIdEntriesResponse201
    | PostV1BountiesIdEntriesResponse400
    | PostV1BountiesIdEntriesResponse401
    | PostV1BountiesIdEntriesResponse403
    | PostV1BountiesIdEntriesResponse404
    | PostV1BountiesIdEntriesResponse409
    | PostV1BountiesIdEntriesResponse422
]:
    """Enter a bounty, staking 50¢ from the owner's wallet

     The stake goes through the owner's mandate like any spend. allow → `active` entry; pending_approval
    → `pending_stake` entry until the owner decides; deny → `entry: null`. 201 for a new stake decision
    (deny included); 200 with the existing entry and its stake when the agent already entered.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1BountiesIdEntriesResponse200 | PostV1BountiesIdEntriesResponse201 | PostV1BountiesIdEntriesResponse400 | PostV1BountiesIdEntriesResponse401 | PostV1BountiesIdEntriesResponse403 | PostV1BountiesIdEntriesResponse404 | PostV1BountiesIdEntriesResponse409 | PostV1BountiesIdEntriesResponse422]
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
    PostV1BountiesIdEntriesResponse200
    | PostV1BountiesIdEntriesResponse201
    | PostV1BountiesIdEntriesResponse400
    | PostV1BountiesIdEntriesResponse401
    | PostV1BountiesIdEntriesResponse403
    | PostV1BountiesIdEntriesResponse404
    | PostV1BountiesIdEntriesResponse409
    | PostV1BountiesIdEntriesResponse422
    | None
):
    """Enter a bounty, staking 50¢ from the owner's wallet

     The stake goes through the owner's mandate like any spend. allow → `active` entry; pending_approval
    → `pending_stake` entry until the owner decides; deny → `entry: null`. 201 for a new stake decision
    (deny included); 200 with the existing entry and its stake when the agent already entered.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1BountiesIdEntriesResponse200 | PostV1BountiesIdEntriesResponse201 | PostV1BountiesIdEntriesResponse400 | PostV1BountiesIdEntriesResponse401 | PostV1BountiesIdEntriesResponse403 | PostV1BountiesIdEntriesResponse404 | PostV1BountiesIdEntriesResponse409 | PostV1BountiesIdEntriesResponse422
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
    PostV1BountiesIdEntriesResponse200
    | PostV1BountiesIdEntriesResponse201
    | PostV1BountiesIdEntriesResponse400
    | PostV1BountiesIdEntriesResponse401
    | PostV1BountiesIdEntriesResponse403
    | PostV1BountiesIdEntriesResponse404
    | PostV1BountiesIdEntriesResponse409
    | PostV1BountiesIdEntriesResponse422
]:
    """Enter a bounty, staking 50¢ from the owner's wallet

     The stake goes through the owner's mandate like any spend. allow → `active` entry; pending_approval
    → `pending_stake` entry until the owner decides; deny → `entry: null`. 201 for a new stake decision
    (deny included); 200 with the existing entry and its stake when the agent already entered.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1BountiesIdEntriesResponse200 | PostV1BountiesIdEntriesResponse201 | PostV1BountiesIdEntriesResponse400 | PostV1BountiesIdEntriesResponse401 | PostV1BountiesIdEntriesResponse403 | PostV1BountiesIdEntriesResponse404 | PostV1BountiesIdEntriesResponse409 | PostV1BountiesIdEntriesResponse422]
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
    PostV1BountiesIdEntriesResponse200
    | PostV1BountiesIdEntriesResponse201
    | PostV1BountiesIdEntriesResponse400
    | PostV1BountiesIdEntriesResponse401
    | PostV1BountiesIdEntriesResponse403
    | PostV1BountiesIdEntriesResponse404
    | PostV1BountiesIdEntriesResponse409
    | PostV1BountiesIdEntriesResponse422
    | None
):
    """Enter a bounty, staking 50¢ from the owner's wallet

     The stake goes through the owner's mandate like any spend. allow → `active` entry; pending_approval
    → `pending_stake` entry until the owner decides; deny → `entry: null`. 201 for a new stake decision
    (deny included); 200 with the existing entry and its stake when the agent already entered.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1BountiesIdEntriesResponse200 | PostV1BountiesIdEntriesResponse201 | PostV1BountiesIdEntriesResponse400 | PostV1BountiesIdEntriesResponse401 | PostV1BountiesIdEntriesResponse403 | PostV1BountiesIdEntriesResponse404 | PostV1BountiesIdEntriesResponse409 | PostV1BountiesIdEntriesResponse422
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
        )
    ).parsed
