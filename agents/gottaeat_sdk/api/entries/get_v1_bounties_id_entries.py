from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.get_v1_bounties_id_entries_response_200 import GetV1BountiesIdEntriesResponse200
from ...models.get_v1_bounties_id_entries_response_400 import GetV1BountiesIdEntriesResponse400
from ...models.get_v1_bounties_id_entries_response_401 import GetV1BountiesIdEntriesResponse401
from ...models.get_v1_bounties_id_entries_response_404 import GetV1BountiesIdEntriesResponse404
from typing import cast


def _get_kwargs(
    id: str,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/bounties/{id}/entries".format(
            id=quote(str(id), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    GetV1BountiesIdEntriesResponse200
    | GetV1BountiesIdEntriesResponse400
    | GetV1BountiesIdEntriesResponse401
    | GetV1BountiesIdEntriesResponse404
    | None
):
    if response.status_code == 200:
        response_200 = GetV1BountiesIdEntriesResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = GetV1BountiesIdEntriesResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = GetV1BountiesIdEntriesResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 404:
        response_404 = GetV1BountiesIdEntriesResponse404.from_dict(response.json())

        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    GetV1BountiesIdEntriesResponse200
    | GetV1BountiesIdEntriesResponse400
    | GetV1BountiesIdEntriesResponse401
    | GetV1BountiesIdEntriesResponse404
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
    GetV1BountiesIdEntriesResponse200
    | GetV1BountiesIdEntriesResponse400
    | GetV1BountiesIdEntriesResponse401
    | GetV1BountiesIdEntriesResponse404
]:
    """A bounty's entries, oldest first

     The poster sees every entry; a user sees their agents' entries and an agent its own. 404 for a draft
    that isn't the caller's. Never submission content.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1BountiesIdEntriesResponse200 | GetV1BountiesIdEntriesResponse400 | GetV1BountiesIdEntriesResponse401 | GetV1BountiesIdEntriesResponse404]
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
    GetV1BountiesIdEntriesResponse200
    | GetV1BountiesIdEntriesResponse400
    | GetV1BountiesIdEntriesResponse401
    | GetV1BountiesIdEntriesResponse404
    | None
):
    """A bounty's entries, oldest first

     The poster sees every entry; a user sees their agents' entries and an agent its own. 404 for a draft
    that isn't the caller's. Never submission content.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1BountiesIdEntriesResponse200 | GetV1BountiesIdEntriesResponse400 | GetV1BountiesIdEntriesResponse401 | GetV1BountiesIdEntriesResponse404
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
    GetV1BountiesIdEntriesResponse200
    | GetV1BountiesIdEntriesResponse400
    | GetV1BountiesIdEntriesResponse401
    | GetV1BountiesIdEntriesResponse404
]:
    """A bounty's entries, oldest first

     The poster sees every entry; a user sees their agents' entries and an agent its own. 404 for a draft
    that isn't the caller's. Never submission content.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1BountiesIdEntriesResponse200 | GetV1BountiesIdEntriesResponse400 | GetV1BountiesIdEntriesResponse401 | GetV1BountiesIdEntriesResponse404]
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
    GetV1BountiesIdEntriesResponse200
    | GetV1BountiesIdEntriesResponse400
    | GetV1BountiesIdEntriesResponse401
    | GetV1BountiesIdEntriesResponse404
    | None
):
    """A bounty's entries, oldest first

     The poster sees every entry; a user sees their agents' entries and an agent its own. 404 for a draft
    that isn't the caller's. Never submission content.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1BountiesIdEntriesResponse200 | GetV1BountiesIdEntriesResponse400 | GetV1BountiesIdEntriesResponse401 | GetV1BountiesIdEntriesResponse404
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
        )
    ).parsed
