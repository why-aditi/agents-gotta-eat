from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.get_v1_subcontracts_id_response_200 import GetV1SubcontractsIdResponse200
from ...models.get_v1_subcontracts_id_response_400 import GetV1SubcontractsIdResponse400
from ...models.get_v1_subcontracts_id_response_401 import GetV1SubcontractsIdResponse401
from ...models.get_v1_subcontracts_id_response_404 import GetV1SubcontractsIdResponse404
from typing import cast


def _get_kwargs(
    id: str,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/subcontracts/{id}".format(
            id=quote(str(id), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    GetV1SubcontractsIdResponse200
    | GetV1SubcontractsIdResponse400
    | GetV1SubcontractsIdResponse401
    | GetV1SubcontractsIdResponse404
    | None
):
    if response.status_code == 200:
        response_200 = GetV1SubcontractsIdResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = GetV1SubcontractsIdResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = GetV1SubcontractsIdResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 404:
        response_404 = GetV1SubcontractsIdResponse404.from_dict(response.json())

        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    GetV1SubcontractsIdResponse200
    | GetV1SubcontractsIdResponse400
    | GetV1SubcontractsIdResponse401
    | GetV1SubcontractsIdResponse404
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
    GetV1SubcontractsIdResponse200
    | GetV1SubcontractsIdResponse400
    | GetV1SubcontractsIdResponse401
    | GetV1SubcontractsIdResponse404
]:
    """One subcontract

     Only the hirer and the worker (their agents and owners) can read it; anyone else gets 404.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1SubcontractsIdResponse200 | GetV1SubcontractsIdResponse400 | GetV1SubcontractsIdResponse401 | GetV1SubcontractsIdResponse404]
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
    GetV1SubcontractsIdResponse200
    | GetV1SubcontractsIdResponse400
    | GetV1SubcontractsIdResponse401
    | GetV1SubcontractsIdResponse404
    | None
):
    """One subcontract

     Only the hirer and the worker (their agents and owners) can read it; anyone else gets 404.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1SubcontractsIdResponse200 | GetV1SubcontractsIdResponse400 | GetV1SubcontractsIdResponse401 | GetV1SubcontractsIdResponse404
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
    GetV1SubcontractsIdResponse200
    | GetV1SubcontractsIdResponse400
    | GetV1SubcontractsIdResponse401
    | GetV1SubcontractsIdResponse404
]:
    """One subcontract

     Only the hirer and the worker (their agents and owners) can read it; anyone else gets 404.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1SubcontractsIdResponse200 | GetV1SubcontractsIdResponse400 | GetV1SubcontractsIdResponse401 | GetV1SubcontractsIdResponse404]
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
    GetV1SubcontractsIdResponse200
    | GetV1SubcontractsIdResponse400
    | GetV1SubcontractsIdResponse401
    | GetV1SubcontractsIdResponse404
    | None
):
    """One subcontract

     Only the hirer and the worker (their agents and owners) can read it; anyone else gets 404.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1SubcontractsIdResponse200 | GetV1SubcontractsIdResponse400 | GetV1SubcontractsIdResponse401 | GetV1SubcontractsIdResponse404
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
        )
    ).parsed
