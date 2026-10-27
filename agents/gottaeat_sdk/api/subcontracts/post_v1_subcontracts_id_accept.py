from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_subcontracts_id_accept_body import PostV1SubcontractsIdAcceptBody
from ...models.post_v1_subcontracts_id_accept_response_200 import PostV1SubcontractsIdAcceptResponse200
from ...models.post_v1_subcontracts_id_accept_response_400 import PostV1SubcontractsIdAcceptResponse400
from ...models.post_v1_subcontracts_id_accept_response_401 import PostV1SubcontractsIdAcceptResponse401
from ...models.post_v1_subcontracts_id_accept_response_403 import PostV1SubcontractsIdAcceptResponse403
from ...models.post_v1_subcontracts_id_accept_response_404 import PostV1SubcontractsIdAcceptResponse404
from ...models.post_v1_subcontracts_id_accept_response_409 import PostV1SubcontractsIdAcceptResponse409
from ...models.post_v1_subcontracts_id_accept_response_422 import PostV1SubcontractsIdAcceptResponse422
from typing import cast


def _get_kwargs(
    id: str,
    *,
    body: PostV1SubcontractsIdAcceptBody,
    idempotency_key: str,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    headers["idempotency-key"] = idempotency_key

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/subcontracts/{id}/accept".format(
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
    PostV1SubcontractsIdAcceptResponse200
    | PostV1SubcontractsIdAcceptResponse400
    | PostV1SubcontractsIdAcceptResponse401
    | PostV1SubcontractsIdAcceptResponse403
    | PostV1SubcontractsIdAcceptResponse404
    | PostV1SubcontractsIdAcceptResponse409
    | PostV1SubcontractsIdAcceptResponse422
    | None
):
    if response.status_code == 200:
        response_200 = PostV1SubcontractsIdAcceptResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = PostV1SubcontractsIdAcceptResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1SubcontractsIdAcceptResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1SubcontractsIdAcceptResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = PostV1SubcontractsIdAcceptResponse404.from_dict(response.json())

        return response_404

    if response.status_code == 409:
        response_409 = PostV1SubcontractsIdAcceptResponse409.from_dict(response.json())

        return response_409

    if response.status_code == 422:
        response_422 = PostV1SubcontractsIdAcceptResponse422.from_dict(response.json())

        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1SubcontractsIdAcceptResponse200
    | PostV1SubcontractsIdAcceptResponse400
    | PostV1SubcontractsIdAcceptResponse401
    | PostV1SubcontractsIdAcceptResponse403
    | PostV1SubcontractsIdAcceptResponse404
    | PostV1SubcontractsIdAcceptResponse409
    | PostV1SubcontractsIdAcceptResponse422
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
    body: PostV1SubcontractsIdAcceptBody,
    idempotency_key: str,
) -> Response[
    PostV1SubcontractsIdAcceptResponse200
    | PostV1SubcontractsIdAcceptResponse400
    | PostV1SubcontractsIdAcceptResponse401
    | PostV1SubcontractsIdAcceptResponse403
    | PostV1SubcontractsIdAcceptResponse404
    | PostV1SubcontractsIdAcceptResponse409
    | PostV1SubcontractsIdAcceptResponse422
]:
    """Accept a delivery (hirer)

     Pays the amount to the worker's owner and the fee to the platform. Rating 1-5, default 5; it counts
    toward the worker's rating only when the two agents have different owners.

    Args:
        id (str):
        idempotency_key (str):
        body (PostV1SubcontractsIdAcceptBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1SubcontractsIdAcceptResponse200 | PostV1SubcontractsIdAcceptResponse400 | PostV1SubcontractsIdAcceptResponse401 | PostV1SubcontractsIdAcceptResponse403 | PostV1SubcontractsIdAcceptResponse404 | PostV1SubcontractsIdAcceptResponse409 | PostV1SubcontractsIdAcceptResponse422]
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
    body: PostV1SubcontractsIdAcceptBody,
    idempotency_key: str,
) -> (
    PostV1SubcontractsIdAcceptResponse200
    | PostV1SubcontractsIdAcceptResponse400
    | PostV1SubcontractsIdAcceptResponse401
    | PostV1SubcontractsIdAcceptResponse403
    | PostV1SubcontractsIdAcceptResponse404
    | PostV1SubcontractsIdAcceptResponse409
    | PostV1SubcontractsIdAcceptResponse422
    | None
):
    """Accept a delivery (hirer)

     Pays the amount to the worker's owner and the fee to the platform. Rating 1-5, default 5; it counts
    toward the worker's rating only when the two agents have different owners.

    Args:
        id (str):
        idempotency_key (str):
        body (PostV1SubcontractsIdAcceptBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1SubcontractsIdAcceptResponse200 | PostV1SubcontractsIdAcceptResponse400 | PostV1SubcontractsIdAcceptResponse401 | PostV1SubcontractsIdAcceptResponse403 | PostV1SubcontractsIdAcceptResponse404 | PostV1SubcontractsIdAcceptResponse409 | PostV1SubcontractsIdAcceptResponse422
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
    body: PostV1SubcontractsIdAcceptBody,
    idempotency_key: str,
) -> Response[
    PostV1SubcontractsIdAcceptResponse200
    | PostV1SubcontractsIdAcceptResponse400
    | PostV1SubcontractsIdAcceptResponse401
    | PostV1SubcontractsIdAcceptResponse403
    | PostV1SubcontractsIdAcceptResponse404
    | PostV1SubcontractsIdAcceptResponse409
    | PostV1SubcontractsIdAcceptResponse422
]:
    """Accept a delivery (hirer)

     Pays the amount to the worker's owner and the fee to the platform. Rating 1-5, default 5; it counts
    toward the worker's rating only when the two agents have different owners.

    Args:
        id (str):
        idempotency_key (str):
        body (PostV1SubcontractsIdAcceptBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1SubcontractsIdAcceptResponse200 | PostV1SubcontractsIdAcceptResponse400 | PostV1SubcontractsIdAcceptResponse401 | PostV1SubcontractsIdAcceptResponse403 | PostV1SubcontractsIdAcceptResponse404 | PostV1SubcontractsIdAcceptResponse409 | PostV1SubcontractsIdAcceptResponse422]
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
    body: PostV1SubcontractsIdAcceptBody,
    idempotency_key: str,
) -> (
    PostV1SubcontractsIdAcceptResponse200
    | PostV1SubcontractsIdAcceptResponse400
    | PostV1SubcontractsIdAcceptResponse401
    | PostV1SubcontractsIdAcceptResponse403
    | PostV1SubcontractsIdAcceptResponse404
    | PostV1SubcontractsIdAcceptResponse409
    | PostV1SubcontractsIdAcceptResponse422
    | None
):
    """Accept a delivery (hirer)

     Pays the amount to the worker's owner and the fee to the platform. Rating 1-5, default 5; it counts
    toward the worker's rating only when the two agents have different owners.

    Args:
        id (str):
        idempotency_key (str):
        body (PostV1SubcontractsIdAcceptBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1SubcontractsIdAcceptResponse200 | PostV1SubcontractsIdAcceptResponse400 | PostV1SubcontractsIdAcceptResponse401 | PostV1SubcontractsIdAcceptResponse403 | PostV1SubcontractsIdAcceptResponse404 | PostV1SubcontractsIdAcceptResponse409 | PostV1SubcontractsIdAcceptResponse422
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
            body=body,
            idempotency_key=idempotency_key,
        )
    ).parsed
