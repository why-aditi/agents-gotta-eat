from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_wallet_topups_body import PostV1WalletTopupsBody
from ...models.post_v1_wallet_topups_response_201 import PostV1WalletTopupsResponse201
from ...models.post_v1_wallet_topups_response_400 import PostV1WalletTopupsResponse400
from ...models.post_v1_wallet_topups_response_401 import PostV1WalletTopupsResponse401
from ...models.post_v1_wallet_topups_response_403 import PostV1WalletTopupsResponse403
from ...models.post_v1_wallet_topups_response_404 import PostV1WalletTopupsResponse404
from ...models.post_v1_wallet_topups_response_409 import PostV1WalletTopupsResponse409
from ...models.post_v1_wallet_topups_response_422 import PostV1WalletTopupsResponse422
from ...models.post_v1_wallet_topups_response_502 import PostV1WalletTopupsResponse502
from ...models.post_v1_wallet_topups_response_503 import PostV1WalletTopupsResponse503
from typing import cast


def _get_kwargs(
    *,
    body: PostV1WalletTopupsBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/wallet/topups",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    PostV1WalletTopupsResponse201
    | PostV1WalletTopupsResponse400
    | PostV1WalletTopupsResponse401
    | PostV1WalletTopupsResponse403
    | PostV1WalletTopupsResponse404
    | PostV1WalletTopupsResponse409
    | PostV1WalletTopupsResponse422
    | PostV1WalletTopupsResponse502
    | PostV1WalletTopupsResponse503
    | None
):
    if response.status_code == 201:
        response_201 = PostV1WalletTopupsResponse201.from_dict(response.json())

        return response_201

    if response.status_code == 400:
        response_400 = PostV1WalletTopupsResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1WalletTopupsResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1WalletTopupsResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = PostV1WalletTopupsResponse404.from_dict(response.json())

        return response_404

    if response.status_code == 409:
        response_409 = PostV1WalletTopupsResponse409.from_dict(response.json())

        return response_409

    if response.status_code == 422:
        response_422 = PostV1WalletTopupsResponse422.from_dict(response.json())

        return response_422

    if response.status_code == 502:
        response_502 = PostV1WalletTopupsResponse502.from_dict(response.json())

        return response_502

    if response.status_code == 503:
        response_503 = PostV1WalletTopupsResponse503.from_dict(response.json())

        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1WalletTopupsResponse201
    | PostV1WalletTopupsResponse400
    | PostV1WalletTopupsResponse401
    | PostV1WalletTopupsResponse403
    | PostV1WalletTopupsResponse404
    | PostV1WalletTopupsResponse409
    | PostV1WalletTopupsResponse422
    | PostV1WalletTopupsResponse502
    | PostV1WalletTopupsResponse503
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
    body: PostV1WalletTopupsBody,
) -> Response[
    PostV1WalletTopupsResponse201
    | PostV1WalletTopupsResponse400
    | PostV1WalletTopupsResponse401
    | PostV1WalletTopupsResponse403
    | PostV1WalletTopupsResponse404
    | PostV1WalletTopupsResponse409
    | PostV1WalletTopupsResponse422
    | PostV1WalletTopupsResponse502
    | PostV1WalletTopupsResponse503
]:
    """Start a PayPal top-up

     Minimum $1.00. Returns the PayPal order id for the browser to approve, then call confirm. 503
    `paypal_not_configured` without PayPal credentials.

    Args:
        body (PostV1WalletTopupsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1WalletTopupsResponse201 | PostV1WalletTopupsResponse400 | PostV1WalletTopupsResponse401 | PostV1WalletTopupsResponse403 | PostV1WalletTopupsResponse404 | PostV1WalletTopupsResponse409 | PostV1WalletTopupsResponse422 | PostV1WalletTopupsResponse502 | PostV1WalletTopupsResponse503]
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
    body: PostV1WalletTopupsBody,
) -> (
    PostV1WalletTopupsResponse201
    | PostV1WalletTopupsResponse400
    | PostV1WalletTopupsResponse401
    | PostV1WalletTopupsResponse403
    | PostV1WalletTopupsResponse404
    | PostV1WalletTopupsResponse409
    | PostV1WalletTopupsResponse422
    | PostV1WalletTopupsResponse502
    | PostV1WalletTopupsResponse503
    | None
):
    """Start a PayPal top-up

     Minimum $1.00. Returns the PayPal order id for the browser to approve, then call confirm. 503
    `paypal_not_configured` without PayPal credentials.

    Args:
        body (PostV1WalletTopupsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1WalletTopupsResponse201 | PostV1WalletTopupsResponse400 | PostV1WalletTopupsResponse401 | PostV1WalletTopupsResponse403 | PostV1WalletTopupsResponse404 | PostV1WalletTopupsResponse409 | PostV1WalletTopupsResponse422 | PostV1WalletTopupsResponse502 | PostV1WalletTopupsResponse503
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: PostV1WalletTopupsBody,
) -> Response[
    PostV1WalletTopupsResponse201
    | PostV1WalletTopupsResponse400
    | PostV1WalletTopupsResponse401
    | PostV1WalletTopupsResponse403
    | PostV1WalletTopupsResponse404
    | PostV1WalletTopupsResponse409
    | PostV1WalletTopupsResponse422
    | PostV1WalletTopupsResponse502
    | PostV1WalletTopupsResponse503
]:
    """Start a PayPal top-up

     Minimum $1.00. Returns the PayPal order id for the browser to approve, then call confirm. 503
    `paypal_not_configured` without PayPal credentials.

    Args:
        body (PostV1WalletTopupsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1WalletTopupsResponse201 | PostV1WalletTopupsResponse400 | PostV1WalletTopupsResponse401 | PostV1WalletTopupsResponse403 | PostV1WalletTopupsResponse404 | PostV1WalletTopupsResponse409 | PostV1WalletTopupsResponse422 | PostV1WalletTopupsResponse502 | PostV1WalletTopupsResponse503]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: PostV1WalletTopupsBody,
) -> (
    PostV1WalletTopupsResponse201
    | PostV1WalletTopupsResponse400
    | PostV1WalletTopupsResponse401
    | PostV1WalletTopupsResponse403
    | PostV1WalletTopupsResponse404
    | PostV1WalletTopupsResponse409
    | PostV1WalletTopupsResponse422
    | PostV1WalletTopupsResponse502
    | PostV1WalletTopupsResponse503
    | None
):
    """Start a PayPal top-up

     Minimum $1.00. Returns the PayPal order id for the browser to approve, then call confirm. 503
    `paypal_not_configured` without PayPal credentials.

    Args:
        body (PostV1WalletTopupsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1WalletTopupsResponse201 | PostV1WalletTopupsResponse400 | PostV1WalletTopupsResponse401 | PostV1WalletTopupsResponse403 | PostV1WalletTopupsResponse404 | PostV1WalletTopupsResponse409 | PostV1WalletTopupsResponse422 | PostV1WalletTopupsResponse502 | PostV1WalletTopupsResponse503
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
