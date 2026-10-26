from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_admin_wallets_user_id_credit_body import PostV1AdminWalletsUserIdCreditBody
from ...models.post_v1_admin_wallets_user_id_credit_response_200 import PostV1AdminWalletsUserIdCreditResponse200
from ...models.post_v1_admin_wallets_user_id_credit_response_400 import PostV1AdminWalletsUserIdCreditResponse400
from ...models.post_v1_admin_wallets_user_id_credit_response_401 import PostV1AdminWalletsUserIdCreditResponse401
from ...models.post_v1_admin_wallets_user_id_credit_response_403 import PostV1AdminWalletsUserIdCreditResponse403
from ...models.post_v1_admin_wallets_user_id_credit_response_404 import PostV1AdminWalletsUserIdCreditResponse404
from ...models.post_v1_admin_wallets_user_id_credit_response_409 import PostV1AdminWalletsUserIdCreditResponse409
from ...models.post_v1_admin_wallets_user_id_credit_response_422 import PostV1AdminWalletsUserIdCreditResponse422
from typing import cast


def _get_kwargs(
    user_id: str,
    *,
    body: PostV1AdminWalletsUserIdCreditBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/admin/wallets/{user_id}/credit".format(
            user_id=quote(str(user_id), safe=""),
        ),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    PostV1AdminWalletsUserIdCreditResponse200
    | PostV1AdminWalletsUserIdCreditResponse400
    | PostV1AdminWalletsUserIdCreditResponse401
    | PostV1AdminWalletsUserIdCreditResponse403
    | PostV1AdminWalletsUserIdCreditResponse404
    | PostV1AdminWalletsUserIdCreditResponse409
    | PostV1AdminWalletsUserIdCreditResponse422
    | None
):
    if response.status_code == 200:
        response_200 = PostV1AdminWalletsUserIdCreditResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = PostV1AdminWalletsUserIdCreditResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1AdminWalletsUserIdCreditResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1AdminWalletsUserIdCreditResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = PostV1AdminWalletsUserIdCreditResponse404.from_dict(response.json())

        return response_404

    if response.status_code == 409:
        response_409 = PostV1AdminWalletsUserIdCreditResponse409.from_dict(response.json())

        return response_409

    if response.status_code == 422:
        response_422 = PostV1AdminWalletsUserIdCreditResponse422.from_dict(response.json())

        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1AdminWalletsUserIdCreditResponse200
    | PostV1AdminWalletsUserIdCreditResponse400
    | PostV1AdminWalletsUserIdCreditResponse401
    | PostV1AdminWalletsUserIdCreditResponse403
    | PostV1AdminWalletsUserIdCreditResponse404
    | PostV1AdminWalletsUserIdCreditResponse409
    | PostV1AdminWalletsUserIdCreditResponse422
]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    user_id: str,
    *,
    client: AuthenticatedClient,
    body: PostV1AdminWalletsUserIdCreditBody,
) -> Response[
    PostV1AdminWalletsUserIdCreditResponse200
    | PostV1AdminWalletsUserIdCreditResponse400
    | PostV1AdminWalletsUserIdCreditResponse401
    | PostV1AdminWalletsUserIdCreditResponse403
    | PostV1AdminWalletsUserIdCreditResponse404
    | PostV1AdminWalletsUserIdCreditResponse409
    | PostV1AdminWalletsUserIdCreditResponse422
]:
    """Credit a user's wallet (dev only)

     Admins only. 404 unless the server runs with `ALLOW_DEV_CREDIT=true`.

    Args:
        user_id (str):
        body (PostV1AdminWalletsUserIdCreditBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AdminWalletsUserIdCreditResponse200 | PostV1AdminWalletsUserIdCreditResponse400 | PostV1AdminWalletsUserIdCreditResponse401 | PostV1AdminWalletsUserIdCreditResponse403 | PostV1AdminWalletsUserIdCreditResponse404 | PostV1AdminWalletsUserIdCreditResponse409 | PostV1AdminWalletsUserIdCreditResponse422]
    """

    kwargs = _get_kwargs(
        user_id=user_id,
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    user_id: str,
    *,
    client: AuthenticatedClient,
    body: PostV1AdminWalletsUserIdCreditBody,
) -> (
    PostV1AdminWalletsUserIdCreditResponse200
    | PostV1AdminWalletsUserIdCreditResponse400
    | PostV1AdminWalletsUserIdCreditResponse401
    | PostV1AdminWalletsUserIdCreditResponse403
    | PostV1AdminWalletsUserIdCreditResponse404
    | PostV1AdminWalletsUserIdCreditResponse409
    | PostV1AdminWalletsUserIdCreditResponse422
    | None
):
    """Credit a user's wallet (dev only)

     Admins only. 404 unless the server runs with `ALLOW_DEV_CREDIT=true`.

    Args:
        user_id (str):
        body (PostV1AdminWalletsUserIdCreditBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AdminWalletsUserIdCreditResponse200 | PostV1AdminWalletsUserIdCreditResponse400 | PostV1AdminWalletsUserIdCreditResponse401 | PostV1AdminWalletsUserIdCreditResponse403 | PostV1AdminWalletsUserIdCreditResponse404 | PostV1AdminWalletsUserIdCreditResponse409 | PostV1AdminWalletsUserIdCreditResponse422
    """

    return sync_detailed(
        user_id=user_id,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    user_id: str,
    *,
    client: AuthenticatedClient,
    body: PostV1AdminWalletsUserIdCreditBody,
) -> Response[
    PostV1AdminWalletsUserIdCreditResponse200
    | PostV1AdminWalletsUserIdCreditResponse400
    | PostV1AdminWalletsUserIdCreditResponse401
    | PostV1AdminWalletsUserIdCreditResponse403
    | PostV1AdminWalletsUserIdCreditResponse404
    | PostV1AdminWalletsUserIdCreditResponse409
    | PostV1AdminWalletsUserIdCreditResponse422
]:
    """Credit a user's wallet (dev only)

     Admins only. 404 unless the server runs with `ALLOW_DEV_CREDIT=true`.

    Args:
        user_id (str):
        body (PostV1AdminWalletsUserIdCreditBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AdminWalletsUserIdCreditResponse200 | PostV1AdminWalletsUserIdCreditResponse400 | PostV1AdminWalletsUserIdCreditResponse401 | PostV1AdminWalletsUserIdCreditResponse403 | PostV1AdminWalletsUserIdCreditResponse404 | PostV1AdminWalletsUserIdCreditResponse409 | PostV1AdminWalletsUserIdCreditResponse422]
    """

    kwargs = _get_kwargs(
        user_id=user_id,
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    user_id: str,
    *,
    client: AuthenticatedClient,
    body: PostV1AdminWalletsUserIdCreditBody,
) -> (
    PostV1AdminWalletsUserIdCreditResponse200
    | PostV1AdminWalletsUserIdCreditResponse400
    | PostV1AdminWalletsUserIdCreditResponse401
    | PostV1AdminWalletsUserIdCreditResponse403
    | PostV1AdminWalletsUserIdCreditResponse404
    | PostV1AdminWalletsUserIdCreditResponse409
    | PostV1AdminWalletsUserIdCreditResponse422
    | None
):
    """Credit a user's wallet (dev only)

     Admins only. 404 unless the server runs with `ALLOW_DEV_CREDIT=true`.

    Args:
        user_id (str):
        body (PostV1AdminWalletsUserIdCreditBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AdminWalletsUserIdCreditResponse200 | PostV1AdminWalletsUserIdCreditResponse400 | PostV1AdminWalletsUserIdCreditResponse401 | PostV1AdminWalletsUserIdCreditResponse403 | PostV1AdminWalletsUserIdCreditResponse404 | PostV1AdminWalletsUserIdCreditResponse409 | PostV1AdminWalletsUserIdCreditResponse422
    """

    return (
        await asyncio_detailed(
            user_id=user_id,
            client=client,
            body=body,
        )
    ).parsed
