from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.get_v1_wallet_withdrawals_response_200 import GetV1WalletWithdrawalsResponse200
from ...models.get_v1_wallet_withdrawals_response_401 import GetV1WalletWithdrawalsResponse401
from ...models.get_v1_wallet_withdrawals_response_403 import GetV1WalletWithdrawalsResponse403
from typing import cast


def _get_kwargs() -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/wallet/withdrawals",
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GetV1WalletWithdrawalsResponse200 | GetV1WalletWithdrawalsResponse401 | GetV1WalletWithdrawalsResponse403 | None:
    if response.status_code == 200:
        response_200 = GetV1WalletWithdrawalsResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 401:
        response_401 = GetV1WalletWithdrawalsResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = GetV1WalletWithdrawalsResponse403.from_dict(response.json())

        return response_403

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    GetV1WalletWithdrawalsResponse200 | GetV1WalletWithdrawalsResponse401 | GetV1WalletWithdrawalsResponse403
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
) -> Response[
    GetV1WalletWithdrawalsResponse200 | GetV1WalletWithdrawalsResponse401 | GetV1WalletWithdrawalsResponse403
]:
    """The caller's withdrawals, newest first (at most 100)

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1WalletWithdrawalsResponse200 | GetV1WalletWithdrawalsResponse401 | GetV1WalletWithdrawalsResponse403]
    """

    kwargs = _get_kwargs()

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
) -> GetV1WalletWithdrawalsResponse200 | GetV1WalletWithdrawalsResponse401 | GetV1WalletWithdrawalsResponse403 | None:
    """The caller's withdrawals, newest first (at most 100)

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1WalletWithdrawalsResponse200 | GetV1WalletWithdrawalsResponse401 | GetV1WalletWithdrawalsResponse403
    """

    return sync_detailed(
        client=client,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
) -> Response[
    GetV1WalletWithdrawalsResponse200 | GetV1WalletWithdrawalsResponse401 | GetV1WalletWithdrawalsResponse403
]:
    """The caller's withdrawals, newest first (at most 100)

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1WalletWithdrawalsResponse200 | GetV1WalletWithdrawalsResponse401 | GetV1WalletWithdrawalsResponse403]
    """

    kwargs = _get_kwargs()

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
) -> GetV1WalletWithdrawalsResponse200 | GetV1WalletWithdrawalsResponse401 | GetV1WalletWithdrawalsResponse403 | None:
    """The caller's withdrawals, newest first (at most 100)

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1WalletWithdrawalsResponse200 | GetV1WalletWithdrawalsResponse401 | GetV1WalletWithdrawalsResponse403
    """

    return (
        await asyncio_detailed(
            client=client,
        )
    ).parsed
