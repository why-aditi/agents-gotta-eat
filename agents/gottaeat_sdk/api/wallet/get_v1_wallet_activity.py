from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.get_v1_wallet_activity_response_200 import GetV1WalletActivityResponse200
from ...models.get_v1_wallet_activity_response_400 import GetV1WalletActivityResponse400
from ...models.get_v1_wallet_activity_response_401 import GetV1WalletActivityResponse401
from ...models.get_v1_wallet_activity_response_403 import GetV1WalletActivityResponse403
from ...types import UNSET, Unset
from typing import cast


def _get_kwargs(
    *,
    limit: int | Unset = 50,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["limit"] = limit

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/wallet/activity",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    GetV1WalletActivityResponse200
    | GetV1WalletActivityResponse400
    | GetV1WalletActivityResponse401
    | GetV1WalletActivityResponse403
    | None
):
    if response.status_code == 200:
        response_200 = GetV1WalletActivityResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = GetV1WalletActivityResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = GetV1WalletActivityResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = GetV1WalletActivityResponse403.from_dict(response.json())

        return response_403

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    GetV1WalletActivityResponse200
    | GetV1WalletActivityResponse400
    | GetV1WalletActivityResponse401
    | GetV1WalletActivityResponse403
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
    limit: int | Unset = 50,
) -> Response[
    GetV1WalletActivityResponse200
    | GetV1WalletActivityResponse400
    | GetV1WalletActivityResponse401
    | GetV1WalletActivityResponse403
]:
    """The owner's wallet movements, newest first

     One item per ledger journal that moved the available balance. `amountCents` is signed: positive is
    money in. `limit` is 1-100 (default 50). `agentName` is agent-supplied text.

    Args:
        limit (int | Unset):  Default: 50.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1WalletActivityResponse200 | GetV1WalletActivityResponse400 | GetV1WalletActivityResponse401 | GetV1WalletActivityResponse403]
    """

    kwargs = _get_kwargs(
        limit=limit,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
    limit: int | Unset = 50,
) -> (
    GetV1WalletActivityResponse200
    | GetV1WalletActivityResponse400
    | GetV1WalletActivityResponse401
    | GetV1WalletActivityResponse403
    | None
):
    """The owner's wallet movements, newest first

     One item per ledger journal that moved the available balance. `amountCents` is signed: positive is
    money in. `limit` is 1-100 (default 50). `agentName` is agent-supplied text.

    Args:
        limit (int | Unset):  Default: 50.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1WalletActivityResponse200 | GetV1WalletActivityResponse400 | GetV1WalletActivityResponse401 | GetV1WalletActivityResponse403
    """

    return sync_detailed(
        client=client,
        limit=limit,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    limit: int | Unset = 50,
) -> Response[
    GetV1WalletActivityResponse200
    | GetV1WalletActivityResponse400
    | GetV1WalletActivityResponse401
    | GetV1WalletActivityResponse403
]:
    """The owner's wallet movements, newest first

     One item per ledger journal that moved the available balance. `amountCents` is signed: positive is
    money in. `limit` is 1-100 (default 50). `agentName` is agent-supplied text.

    Args:
        limit (int | Unset):  Default: 50.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1WalletActivityResponse200 | GetV1WalletActivityResponse400 | GetV1WalletActivityResponse401 | GetV1WalletActivityResponse403]
    """

    kwargs = _get_kwargs(
        limit=limit,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    limit: int | Unset = 50,
) -> (
    GetV1WalletActivityResponse200
    | GetV1WalletActivityResponse400
    | GetV1WalletActivityResponse401
    | GetV1WalletActivityResponse403
    | None
):
    """The owner's wallet movements, newest first

     One item per ledger journal that moved the available balance. `amountCents` is signed: positive is
    money in. `limit` is 1-100 (default 50). `agentName` is agent-supplied text.

    Args:
        limit (int | Unset):  Default: 50.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1WalletActivityResponse200 | GetV1WalletActivityResponse400 | GetV1WalletActivityResponse401 | GetV1WalletActivityResponse403
    """

    return (
        await asyncio_detailed(
            client=client,
            limit=limit,
        )
    ).parsed
