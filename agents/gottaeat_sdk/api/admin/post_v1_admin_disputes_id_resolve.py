from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_admin_disputes_id_resolve_body import PostV1AdminDisputesIdResolveBody
from ...models.post_v1_admin_disputes_id_resolve_response_200 import PostV1AdminDisputesIdResolveResponse200
from ...models.post_v1_admin_disputes_id_resolve_response_400 import PostV1AdminDisputesIdResolveResponse400
from ...models.post_v1_admin_disputes_id_resolve_response_401 import PostV1AdminDisputesIdResolveResponse401
from ...models.post_v1_admin_disputes_id_resolve_response_403 import PostV1AdminDisputesIdResolveResponse403
from ...models.post_v1_admin_disputes_id_resolve_response_404 import PostV1AdminDisputesIdResolveResponse404
from ...models.post_v1_admin_disputes_id_resolve_response_409 import PostV1AdminDisputesIdResolveResponse409
from ...models.post_v1_admin_disputes_id_resolve_response_422 import PostV1AdminDisputesIdResolveResponse422
from ...models.post_v1_admin_disputes_id_resolve_response_502 import PostV1AdminDisputesIdResolveResponse502
from ...models.post_v1_admin_disputes_id_resolve_response_503 import PostV1AdminDisputesIdResolveResponse503
from typing import cast


def _get_kwargs(
    id: str,
    *,
    body: PostV1AdminDisputesIdResolveBody,
    idempotency_key: str,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    headers["idempotency-key"] = idempotency_key

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/admin/disputes/{id}/resolve".format(
            id=quote(str(id), safe=""),
        ),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    PostV1AdminDisputesIdResolveResponse200
    | PostV1AdminDisputesIdResolveResponse400
    | PostV1AdminDisputesIdResolveResponse401
    | PostV1AdminDisputesIdResolveResponse403
    | PostV1AdminDisputesIdResolveResponse404
    | PostV1AdminDisputesIdResolveResponse409
    | PostV1AdminDisputesIdResolveResponse422
    | PostV1AdminDisputesIdResolveResponse502
    | PostV1AdminDisputesIdResolveResponse503
    | None
):
    if response.status_code == 200:
        response_200 = PostV1AdminDisputesIdResolveResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = PostV1AdminDisputesIdResolveResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1AdminDisputesIdResolveResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1AdminDisputesIdResolveResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = PostV1AdminDisputesIdResolveResponse404.from_dict(response.json())

        return response_404

    if response.status_code == 409:
        response_409 = PostV1AdminDisputesIdResolveResponse409.from_dict(response.json())

        return response_409

    if response.status_code == 422:
        response_422 = PostV1AdminDisputesIdResolveResponse422.from_dict(response.json())

        return response_422

    if response.status_code == 502:
        response_502 = PostV1AdminDisputesIdResolveResponse502.from_dict(response.json())

        return response_502

    if response.status_code == 503:
        response_503 = PostV1AdminDisputesIdResolveResponse503.from_dict(response.json())

        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1AdminDisputesIdResolveResponse200
    | PostV1AdminDisputesIdResolveResponse400
    | PostV1AdminDisputesIdResolveResponse401
    | PostV1AdminDisputesIdResolveResponse403
    | PostV1AdminDisputesIdResolveResponse404
    | PostV1AdminDisputesIdResolveResponse409
    | PostV1AdminDisputesIdResolveResponse422
    | PostV1AdminDisputesIdResolveResponse502
    | PostV1AdminDisputesIdResolveResponse503
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
    body: PostV1AdminDisputesIdResolveBody,
    idempotency_key: str,
) -> Response[
    PostV1AdminDisputesIdResolveResponse200
    | PostV1AdminDisputesIdResolveResponse400
    | PostV1AdminDisputesIdResolveResponse401
    | PostV1AdminDisputesIdResolveResponse403
    | PostV1AdminDisputesIdResolveResponse404
    | PostV1AdminDisputesIdResolveResponse409
    | PostV1AdminDisputesIdResolveResponse422
    | PostV1AdminDisputesIdResolveResponse502
    | PostV1AdminDisputesIdResolveResponse503
]:
    """Uphold or overturn a dispute

     Admins only. `uphold`: the held reward goes to the winner's wallet. `overturn`: the reward goes back
    to the poster (a PayPal refund of the capture for a PayPal escrow, the poster's wallet for a dev
    escrow); the platform keeps the fee and the bounty keeps its winner on record. 409
    `dispute_not_open` once resolved; 502 `paypal_error` when the refund fails (the dispute stays open).

    Args:
        id (str):
        idempotency_key (str):
        body (PostV1AdminDisputesIdResolveBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AdminDisputesIdResolveResponse200 | PostV1AdminDisputesIdResolveResponse400 | PostV1AdminDisputesIdResolveResponse401 | PostV1AdminDisputesIdResolveResponse403 | PostV1AdminDisputesIdResolveResponse404 | PostV1AdminDisputesIdResolveResponse409 | PostV1AdminDisputesIdResolveResponse422 | PostV1AdminDisputesIdResolveResponse502 | PostV1AdminDisputesIdResolveResponse503]
    """

    kwargs = _get_kwargs(
        id=id,
        body=body,
        idempotency_key=idempotency_key,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    id: str,
    *,
    client: AuthenticatedClient,
    body: PostV1AdminDisputesIdResolveBody,
    idempotency_key: str,
) -> (
    PostV1AdminDisputesIdResolveResponse200
    | PostV1AdminDisputesIdResolveResponse400
    | PostV1AdminDisputesIdResolveResponse401
    | PostV1AdminDisputesIdResolveResponse403
    | PostV1AdminDisputesIdResolveResponse404
    | PostV1AdminDisputesIdResolveResponse409
    | PostV1AdminDisputesIdResolveResponse422
    | PostV1AdminDisputesIdResolveResponse502
    | PostV1AdminDisputesIdResolveResponse503
    | None
):
    """Uphold or overturn a dispute

     Admins only. `uphold`: the held reward goes to the winner's wallet. `overturn`: the reward goes back
    to the poster (a PayPal refund of the capture for a PayPal escrow, the poster's wallet for a dev
    escrow); the platform keeps the fee and the bounty keeps its winner on record. 409
    `dispute_not_open` once resolved; 502 `paypal_error` when the refund fails (the dispute stays open).

    Args:
        id (str):
        idempotency_key (str):
        body (PostV1AdminDisputesIdResolveBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AdminDisputesIdResolveResponse200 | PostV1AdminDisputesIdResolveResponse400 | PostV1AdminDisputesIdResolveResponse401 | PostV1AdminDisputesIdResolveResponse403 | PostV1AdminDisputesIdResolveResponse404 | PostV1AdminDisputesIdResolveResponse409 | PostV1AdminDisputesIdResolveResponse422 | PostV1AdminDisputesIdResolveResponse502 | PostV1AdminDisputesIdResolveResponse503
    """

    return sync_detailed(
        id=id,
        client=client,
        body=body,
        idempotency_key=idempotency_key,
    ).parsed


async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient,
    body: PostV1AdminDisputesIdResolveBody,
    idempotency_key: str,
) -> Response[
    PostV1AdminDisputesIdResolveResponse200
    | PostV1AdminDisputesIdResolveResponse400
    | PostV1AdminDisputesIdResolveResponse401
    | PostV1AdminDisputesIdResolveResponse403
    | PostV1AdminDisputesIdResolveResponse404
    | PostV1AdminDisputesIdResolveResponse409
    | PostV1AdminDisputesIdResolveResponse422
    | PostV1AdminDisputesIdResolveResponse502
    | PostV1AdminDisputesIdResolveResponse503
]:
    """Uphold or overturn a dispute

     Admins only. `uphold`: the held reward goes to the winner's wallet. `overturn`: the reward goes back
    to the poster (a PayPal refund of the capture for a PayPal escrow, the poster's wallet for a dev
    escrow); the platform keeps the fee and the bounty keeps its winner on record. 409
    `dispute_not_open` once resolved; 502 `paypal_error` when the refund fails (the dispute stays open).

    Args:
        id (str):
        idempotency_key (str):
        body (PostV1AdminDisputesIdResolveBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AdminDisputesIdResolveResponse200 | PostV1AdminDisputesIdResolveResponse400 | PostV1AdminDisputesIdResolveResponse401 | PostV1AdminDisputesIdResolveResponse403 | PostV1AdminDisputesIdResolveResponse404 | PostV1AdminDisputesIdResolveResponse409 | PostV1AdminDisputesIdResolveResponse422 | PostV1AdminDisputesIdResolveResponse502 | PostV1AdminDisputesIdResolveResponse503]
    """

    kwargs = _get_kwargs(
        id=id,
        body=body,
        idempotency_key=idempotency_key,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient,
    body: PostV1AdminDisputesIdResolveBody,
    idempotency_key: str,
) -> (
    PostV1AdminDisputesIdResolveResponse200
    | PostV1AdminDisputesIdResolveResponse400
    | PostV1AdminDisputesIdResolveResponse401
    | PostV1AdminDisputesIdResolveResponse403
    | PostV1AdminDisputesIdResolveResponse404
    | PostV1AdminDisputesIdResolveResponse409
    | PostV1AdminDisputesIdResolveResponse422
    | PostV1AdminDisputesIdResolveResponse502
    | PostV1AdminDisputesIdResolveResponse503
    | None
):
    """Uphold or overturn a dispute

     Admins only. `uphold`: the held reward goes to the winner's wallet. `overturn`: the reward goes back
    to the poster (a PayPal refund of the capture for a PayPal escrow, the poster's wallet for a dev
    escrow); the platform keeps the fee and the bounty keeps its winner on record. 409
    `dispute_not_open` once resolved; 502 `paypal_error` when the refund fails (the dispute stays open).

    Args:
        id (str):
        idempotency_key (str):
        body (PostV1AdminDisputesIdResolveBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AdminDisputesIdResolveResponse200 | PostV1AdminDisputesIdResolveResponse400 | PostV1AdminDisputesIdResolveResponse401 | PostV1AdminDisputesIdResolveResponse403 | PostV1AdminDisputesIdResolveResponse404 | PostV1AdminDisputesIdResolveResponse409 | PostV1AdminDisputesIdResolveResponse422 | PostV1AdminDisputesIdResolveResponse502 | PostV1AdminDisputesIdResolveResponse503
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
            body=body,
            idempotency_key=idempotency_key,
        )
    ).parsed
