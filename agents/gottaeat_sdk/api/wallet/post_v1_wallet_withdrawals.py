from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_wallet_withdrawals_body import PostV1WalletWithdrawalsBody
from ...models.post_v1_wallet_withdrawals_response_202 import PostV1WalletWithdrawalsResponse202
from ...models.post_v1_wallet_withdrawals_response_400 import PostV1WalletWithdrawalsResponse400
from ...models.post_v1_wallet_withdrawals_response_401 import PostV1WalletWithdrawalsResponse401
from ...models.post_v1_wallet_withdrawals_response_403 import PostV1WalletWithdrawalsResponse403
from ...models.post_v1_wallet_withdrawals_response_404 import PostV1WalletWithdrawalsResponse404
from ...models.post_v1_wallet_withdrawals_response_409 import PostV1WalletWithdrawalsResponse409
from ...models.post_v1_wallet_withdrawals_response_422 import PostV1WalletWithdrawalsResponse422
from ...models.post_v1_wallet_withdrawals_response_502 import PostV1WalletWithdrawalsResponse502
from ...models.post_v1_wallet_withdrawals_response_503 import PostV1WalletWithdrawalsResponse503
from typing import cast


def _get_kwargs(
    *,
    body: PostV1WalletWithdrawalsBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/wallet/withdrawals",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    PostV1WalletWithdrawalsResponse202
    | PostV1WalletWithdrawalsResponse400
    | PostV1WalletWithdrawalsResponse401
    | PostV1WalletWithdrawalsResponse403
    | PostV1WalletWithdrawalsResponse404
    | PostV1WalletWithdrawalsResponse409
    | PostV1WalletWithdrawalsResponse422
    | PostV1WalletWithdrawalsResponse502
    | PostV1WalletWithdrawalsResponse503
    | None
):
    if response.status_code == 202:
        response_202 = PostV1WalletWithdrawalsResponse202.from_dict(response.json())

        return response_202

    if response.status_code == 400:
        response_400 = PostV1WalletWithdrawalsResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1WalletWithdrawalsResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1WalletWithdrawalsResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = PostV1WalletWithdrawalsResponse404.from_dict(response.json())

        return response_404

    if response.status_code == 409:
        response_409 = PostV1WalletWithdrawalsResponse409.from_dict(response.json())

        return response_409

    if response.status_code == 422:
        response_422 = PostV1WalletWithdrawalsResponse422.from_dict(response.json())

        return response_422

    if response.status_code == 502:
        response_502 = PostV1WalletWithdrawalsResponse502.from_dict(response.json())

        return response_502

    if response.status_code == 503:
        response_503 = PostV1WalletWithdrawalsResponse503.from_dict(response.json())

        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1WalletWithdrawalsResponse202
    | PostV1WalletWithdrawalsResponse400
    | PostV1WalletWithdrawalsResponse401
    | PostV1WalletWithdrawalsResponse403
    | PostV1WalletWithdrawalsResponse404
    | PostV1WalletWithdrawalsResponse409
    | PostV1WalletWithdrawalsResponse422
    | PostV1WalletWithdrawalsResponse502
    | PostV1WalletWithdrawalsResponse503
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
    body: PostV1WalletWithdrawalsBody,
) -> Response[
    PostV1WalletWithdrawalsResponse202
    | PostV1WalletWithdrawalsResponse400
    | PostV1WalletWithdrawalsResponse401
    | PostV1WalletWithdrawalsResponse403
    | PostV1WalletWithdrawalsResponse404
    | PostV1WalletWithdrawalsResponse409
    | PostV1WalletWithdrawalsResponse422
    | PostV1WalletWithdrawalsResponse502
    | PostV1WalletWithdrawalsResponse503
]:
    """Withdraw to the owner's PayPal email

     Minimum $5.00. The amount leaves the wallet at once and is held until PayPal reports the payout; a
    failed or returned payout puts it back. 409 `no_paypal_email` or `insufficient_funds`.

    Args:
        body (PostV1WalletWithdrawalsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1WalletWithdrawalsResponse202 | PostV1WalletWithdrawalsResponse400 | PostV1WalletWithdrawalsResponse401 | PostV1WalletWithdrawalsResponse403 | PostV1WalletWithdrawalsResponse404 | PostV1WalletWithdrawalsResponse409 | PostV1WalletWithdrawalsResponse422 | PostV1WalletWithdrawalsResponse502 | PostV1WalletWithdrawalsResponse503]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
    body: PostV1WalletWithdrawalsBody,
) -> (
    PostV1WalletWithdrawalsResponse202
    | PostV1WalletWithdrawalsResponse400
    | PostV1WalletWithdrawalsResponse401
    | PostV1WalletWithdrawalsResponse403
    | PostV1WalletWithdrawalsResponse404
    | PostV1WalletWithdrawalsResponse409
    | PostV1WalletWithdrawalsResponse422
    | PostV1WalletWithdrawalsResponse502
    | PostV1WalletWithdrawalsResponse503
    | None
):
    """Withdraw to the owner's PayPal email

     Minimum $5.00. The amount leaves the wallet at once and is held until PayPal reports the payout; a
    failed or returned payout puts it back. 409 `no_paypal_email` or `insufficient_funds`.

    Args:
        body (PostV1WalletWithdrawalsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1WalletWithdrawalsResponse202 | PostV1WalletWithdrawalsResponse400 | PostV1WalletWithdrawalsResponse401 | PostV1WalletWithdrawalsResponse403 | PostV1WalletWithdrawalsResponse404 | PostV1WalletWithdrawalsResponse409 | PostV1WalletWithdrawalsResponse422 | PostV1WalletWithdrawalsResponse502 | PostV1WalletWithdrawalsResponse503
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: PostV1WalletWithdrawalsBody,
) -> Response[
    PostV1WalletWithdrawalsResponse202
    | PostV1WalletWithdrawalsResponse400
    | PostV1WalletWithdrawalsResponse401
    | PostV1WalletWithdrawalsResponse403
    | PostV1WalletWithdrawalsResponse404
    | PostV1WalletWithdrawalsResponse409
    | PostV1WalletWithdrawalsResponse422
    | PostV1WalletWithdrawalsResponse502
    | PostV1WalletWithdrawalsResponse503
]:
    """Withdraw to the owner's PayPal email

     Minimum $5.00. The amount leaves the wallet at once and is held until PayPal reports the payout; a
    failed or returned payout puts it back. 409 `no_paypal_email` or `insufficient_funds`.

    Args:
        body (PostV1WalletWithdrawalsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1WalletWithdrawalsResponse202 | PostV1WalletWithdrawalsResponse400 | PostV1WalletWithdrawalsResponse401 | PostV1WalletWithdrawalsResponse403 | PostV1WalletWithdrawalsResponse404 | PostV1WalletWithdrawalsResponse409 | PostV1WalletWithdrawalsResponse422 | PostV1WalletWithdrawalsResponse502 | PostV1WalletWithdrawalsResponse503]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: PostV1WalletWithdrawalsBody,
) -> (
    PostV1WalletWithdrawalsResponse202
    | PostV1WalletWithdrawalsResponse400
    | PostV1WalletWithdrawalsResponse401
    | PostV1WalletWithdrawalsResponse403
    | PostV1WalletWithdrawalsResponse404
    | PostV1WalletWithdrawalsResponse409
    | PostV1WalletWithdrawalsResponse422
    | PostV1WalletWithdrawalsResponse502
    | PostV1WalletWithdrawalsResponse503
    | None
):
    """Withdraw to the owner's PayPal email

     Minimum $5.00. The amount leaves the wallet at once and is held until PayPal reports the payout; a
    failed or returned payout puts it back. 409 `no_paypal_email` or `insufficient_funds`.

    Args:
        body (PostV1WalletWithdrawalsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1WalletWithdrawalsResponse202 | PostV1WalletWithdrawalsResponse400 | PostV1WalletWithdrawalsResponse401 | PostV1WalletWithdrawalsResponse403 | PostV1WalletWithdrawalsResponse404 | PostV1WalletWithdrawalsResponse409 | PostV1WalletWithdrawalsResponse422 | PostV1WalletWithdrawalsResponse502 | PostV1WalletWithdrawalsResponse503
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
