from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_spend_requests_body import PostV1SpendRequestsBody
from ...models.post_v1_spend_requests_response_201 import PostV1SpendRequestsResponse201
from ...models.post_v1_spend_requests_response_400 import PostV1SpendRequestsResponse400
from ...models.post_v1_spend_requests_response_401 import PostV1SpendRequestsResponse401
from ...models.post_v1_spend_requests_response_403 import PostV1SpendRequestsResponse403
from ...models.post_v1_spend_requests_response_409 import PostV1SpendRequestsResponse409
from ...models.post_v1_spend_requests_response_422 import PostV1SpendRequestsResponse422
from typing import cast


def _get_kwargs(
    *,
    body: PostV1SpendRequestsBody,
    idempotency_key: str,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    headers["idempotency-key"] = idempotency_key

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/spend-requests",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    PostV1SpendRequestsResponse201
    | PostV1SpendRequestsResponse400
    | PostV1SpendRequestsResponse401
    | PostV1SpendRequestsResponse403
    | PostV1SpendRequestsResponse409
    | PostV1SpendRequestsResponse422
    | None
):
    if response.status_code == 201:
        response_201 = PostV1SpendRequestsResponse201.from_dict(response.json())

        return response_201

    if response.status_code == 400:
        response_400 = PostV1SpendRequestsResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1SpendRequestsResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1SpendRequestsResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 409:
        response_409 = PostV1SpendRequestsResponse409.from_dict(response.json())

        return response_409

    if response.status_code == 422:
        response_422 = PostV1SpendRequestsResponse422.from_dict(response.json())

        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1SpendRequestsResponse201
    | PostV1SpendRequestsResponse400
    | PostV1SpendRequestsResponse401
    | PostV1SpendRequestsResponse403
    | PostV1SpendRequestsResponse409
    | PostV1SpendRequestsResponse422
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
    body: PostV1SpendRequestsBody,
    idempotency_key: str,
) -> Response[
    PostV1SpendRequestsResponse201
    | PostV1SpendRequestsResponse400
    | PostV1SpendRequestsResponse401
    | PostV1SpendRequestsResponse403
    | PostV1SpendRequestsResponse409
    | PostV1SpendRequestsResponse422
]:
    """Ask to spend from the owner's wallet

     Policy outcomes (allow, pending_approval, deny) are all 201 responses; errors are for bad input,
    auth or idempotency only.

    Args:
        idempotency_key (str):
        body (PostV1SpendRequestsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1SpendRequestsResponse201 | PostV1SpendRequestsResponse400 | PostV1SpendRequestsResponse401 | PostV1SpendRequestsResponse403 | PostV1SpendRequestsResponse409 | PostV1SpendRequestsResponse422]
    """

    kwargs = _get_kwargs(
        body=body,
        idempotency_key=idempotency_key,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
    body: PostV1SpendRequestsBody,
    idempotency_key: str,
) -> (
    PostV1SpendRequestsResponse201
    | PostV1SpendRequestsResponse400
    | PostV1SpendRequestsResponse401
    | PostV1SpendRequestsResponse403
    | PostV1SpendRequestsResponse409
    | PostV1SpendRequestsResponse422
    | None
):
    """Ask to spend from the owner's wallet

     Policy outcomes (allow, pending_approval, deny) are all 201 responses; errors are for bad input,
    auth or idempotency only.

    Args:
        idempotency_key (str):
        body (PostV1SpendRequestsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1SpendRequestsResponse201 | PostV1SpendRequestsResponse400 | PostV1SpendRequestsResponse401 | PostV1SpendRequestsResponse403 | PostV1SpendRequestsResponse409 | PostV1SpendRequestsResponse422
    """

    return sync_detailed(
        client=client,
        body=body,
        idempotency_key=idempotency_key,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: PostV1SpendRequestsBody,
    idempotency_key: str,
) -> Response[
    PostV1SpendRequestsResponse201
    | PostV1SpendRequestsResponse400
    | PostV1SpendRequestsResponse401
    | PostV1SpendRequestsResponse403
    | PostV1SpendRequestsResponse409
    | PostV1SpendRequestsResponse422
]:
    """Ask to spend from the owner's wallet

     Policy outcomes (allow, pending_approval, deny) are all 201 responses; errors are for bad input,
    auth or idempotency only.

    Args:
        idempotency_key (str):
        body (PostV1SpendRequestsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1SpendRequestsResponse201 | PostV1SpendRequestsResponse400 | PostV1SpendRequestsResponse401 | PostV1SpendRequestsResponse403 | PostV1SpendRequestsResponse409 | PostV1SpendRequestsResponse422]
    """

    kwargs = _get_kwargs(
        body=body,
        idempotency_key=idempotency_key,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: PostV1SpendRequestsBody,
    idempotency_key: str,
) -> (
    PostV1SpendRequestsResponse201
    | PostV1SpendRequestsResponse400
    | PostV1SpendRequestsResponse401
    | PostV1SpendRequestsResponse403
    | PostV1SpendRequestsResponse409
    | PostV1SpendRequestsResponse422
    | None
):
    """Ask to spend from the owner's wallet

     Policy outcomes (allow, pending_approval, deny) are all 201 responses; errors are for bad input,
    auth or idempotency only.

    Args:
        idempotency_key (str):
        body (PostV1SpendRequestsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1SpendRequestsResponse201 | PostV1SpendRequestsResponse400 | PostV1SpendRequestsResponse401 | PostV1SpendRequestsResponse403 | PostV1SpendRequestsResponse409 | PostV1SpendRequestsResponse422
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
            idempotency_key=idempotency_key,
        )
    ).parsed
