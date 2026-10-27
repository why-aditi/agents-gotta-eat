from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_admin_demo_reset_response_200 import PostV1AdminDemoResetResponse200
from ...models.post_v1_admin_demo_reset_response_400 import PostV1AdminDemoResetResponse400
from ...models.post_v1_admin_demo_reset_response_401 import PostV1AdminDemoResetResponse401
from ...models.post_v1_admin_demo_reset_response_403 import PostV1AdminDemoResetResponse403
from ...models.post_v1_admin_demo_reset_response_404 import PostV1AdminDemoResetResponse404
from ...models.post_v1_admin_demo_reset_response_409 import PostV1AdminDemoResetResponse409
from ...models.post_v1_admin_demo_reset_response_422 import PostV1AdminDemoResetResponse422
from typing import cast


def _get_kwargs(
    *,
    idempotency_key: str,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    headers["idempotency-key"] = idempotency_key

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/admin/demo/reset",
    }

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    PostV1AdminDemoResetResponse200
    | PostV1AdminDemoResetResponse400
    | PostV1AdminDemoResetResponse401
    | PostV1AdminDemoResetResponse403
    | PostV1AdminDemoResetResponse404
    | PostV1AdminDemoResetResponse409
    | PostV1AdminDemoResetResponse422
    | None
):
    if response.status_code == 200:
        response_200 = PostV1AdminDemoResetResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = PostV1AdminDemoResetResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1AdminDemoResetResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1AdminDemoResetResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = PostV1AdminDemoResetResponse404.from_dict(response.json())

        return response_404

    if response.status_code == 409:
        response_409 = PostV1AdminDemoResetResponse409.from_dict(response.json())

        return response_409

    if response.status_code == 422:
        response_422 = PostV1AdminDemoResetResponse422.from_dict(response.json())

        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1AdminDemoResetResponse200
    | PostV1AdminDemoResetResponse400
    | PostV1AdminDemoResetResponse401
    | PostV1AdminDemoResetResponse403
    | PostV1AdminDemoResetResponse404
    | PostV1AdminDemoResetResponse409
    | PostV1AdminDemoResetResponse422
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
    idempotency_key: str,
) -> Response[
    PostV1AdminDemoResetResponse200
    | PostV1AdminDemoResetResponse400
    | PostV1AdminDemoResetResponse401
    | PostV1AdminDemoResetResponse403
    | PostV1AdminDemoResetResponse404
    | PostV1AdminDemoResetResponse409
    | PostV1AdminDemoResetResponse422
]:
    """Reset the demo (dev only)

     Admins only. 404 unless the server runs with `ALLOW_DEV_FUNDING=true` and `ALLOW_DEV_CREDIT=true`.
    Creates and opens (dev funding) each seed bounty that isn't open, and tops the house owner's wallet
    back up to $60 with one dev credit of the difference. Needs an `Idempotency-Key`.

    Args:
        idempotency_key (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AdminDemoResetResponse200 | PostV1AdminDemoResetResponse400 | PostV1AdminDemoResetResponse401 | PostV1AdminDemoResetResponse403 | PostV1AdminDemoResetResponse404 | PostV1AdminDemoResetResponse409 | PostV1AdminDemoResetResponse422]
    """

    kwargs = _get_kwargs(
        idempotency_key=idempotency_key,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
    idempotency_key: str,
) -> (
    PostV1AdminDemoResetResponse200
    | PostV1AdminDemoResetResponse400
    | PostV1AdminDemoResetResponse401
    | PostV1AdminDemoResetResponse403
    | PostV1AdminDemoResetResponse404
    | PostV1AdminDemoResetResponse409
    | PostV1AdminDemoResetResponse422
    | None
):
    """Reset the demo (dev only)

     Admins only. 404 unless the server runs with `ALLOW_DEV_FUNDING=true` and `ALLOW_DEV_CREDIT=true`.
    Creates and opens (dev funding) each seed bounty that isn't open, and tops the house owner's wallet
    back up to $60 with one dev credit of the difference. Needs an `Idempotency-Key`.

    Args:
        idempotency_key (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AdminDemoResetResponse200 | PostV1AdminDemoResetResponse400 | PostV1AdminDemoResetResponse401 | PostV1AdminDemoResetResponse403 | PostV1AdminDemoResetResponse404 | PostV1AdminDemoResetResponse409 | PostV1AdminDemoResetResponse422
    """

    return sync_detailed(
        client=client,
        idempotency_key=idempotency_key,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    idempotency_key: str,
) -> Response[
    PostV1AdminDemoResetResponse200
    | PostV1AdminDemoResetResponse400
    | PostV1AdminDemoResetResponse401
    | PostV1AdminDemoResetResponse403
    | PostV1AdminDemoResetResponse404
    | PostV1AdminDemoResetResponse409
    | PostV1AdminDemoResetResponse422
]:
    """Reset the demo (dev only)

     Admins only. 404 unless the server runs with `ALLOW_DEV_FUNDING=true` and `ALLOW_DEV_CREDIT=true`.
    Creates and opens (dev funding) each seed bounty that isn't open, and tops the house owner's wallet
    back up to $60 with one dev credit of the difference. Needs an `Idempotency-Key`.

    Args:
        idempotency_key (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AdminDemoResetResponse200 | PostV1AdminDemoResetResponse400 | PostV1AdminDemoResetResponse401 | PostV1AdminDemoResetResponse403 | PostV1AdminDemoResetResponse404 | PostV1AdminDemoResetResponse409 | PostV1AdminDemoResetResponse422]
    """

    kwargs = _get_kwargs(
        idempotency_key=idempotency_key,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    idempotency_key: str,
) -> (
    PostV1AdminDemoResetResponse200
    | PostV1AdminDemoResetResponse400
    | PostV1AdminDemoResetResponse401
    | PostV1AdminDemoResetResponse403
    | PostV1AdminDemoResetResponse404
    | PostV1AdminDemoResetResponse409
    | PostV1AdminDemoResetResponse422
    | None
):
    """Reset the demo (dev only)

     Admins only. 404 unless the server runs with `ALLOW_DEV_FUNDING=true` and `ALLOW_DEV_CREDIT=true`.
    Creates and opens (dev funding) each seed bounty that isn't open, and tops the house owner's wallet
    back up to $60 with one dev credit of the difference. Needs an `Idempotency-Key`.

    Args:
        idempotency_key (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AdminDemoResetResponse200 | PostV1AdminDemoResetResponse400 | PostV1AdminDemoResetResponse401 | PostV1AdminDemoResetResponse403 | PostV1AdminDemoResetResponse404 | PostV1AdminDemoResetResponse409 | PostV1AdminDemoResetResponse422
    """

    return (
        await asyncio_detailed(
            client=client,
            idempotency_key=idempotency_key,
        )
    ).parsed
