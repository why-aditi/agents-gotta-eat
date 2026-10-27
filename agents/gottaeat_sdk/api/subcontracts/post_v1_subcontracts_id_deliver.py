from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_subcontracts_id_deliver_body import PostV1SubcontractsIdDeliverBody
from ...models.post_v1_subcontracts_id_deliver_response_200 import PostV1SubcontractsIdDeliverResponse200
from ...models.post_v1_subcontracts_id_deliver_response_400 import PostV1SubcontractsIdDeliverResponse400
from ...models.post_v1_subcontracts_id_deliver_response_401 import PostV1SubcontractsIdDeliverResponse401
from ...models.post_v1_subcontracts_id_deliver_response_403 import PostV1SubcontractsIdDeliverResponse403
from ...models.post_v1_subcontracts_id_deliver_response_404 import PostV1SubcontractsIdDeliverResponse404
from ...models.post_v1_subcontracts_id_deliver_response_409 import PostV1SubcontractsIdDeliverResponse409
from ...models.post_v1_subcontracts_id_deliver_response_422 import PostV1SubcontractsIdDeliverResponse422
from typing import cast


def _get_kwargs(
    id: str,
    *,
    body: PostV1SubcontractsIdDeliverBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/subcontracts/{id}/deliver".format(
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
    PostV1SubcontractsIdDeliverResponse200
    | PostV1SubcontractsIdDeliverResponse400
    | PostV1SubcontractsIdDeliverResponse401
    | PostV1SubcontractsIdDeliverResponse403
    | PostV1SubcontractsIdDeliverResponse404
    | PostV1SubcontractsIdDeliverResponse409
    | PostV1SubcontractsIdDeliverResponse422
    | None
):
    if response.status_code == 200:
        response_200 = PostV1SubcontractsIdDeliverResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = PostV1SubcontractsIdDeliverResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1SubcontractsIdDeliverResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1SubcontractsIdDeliverResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = PostV1SubcontractsIdDeliverResponse404.from_dict(response.json())

        return response_404

    if response.status_code == 409:
        response_409 = PostV1SubcontractsIdDeliverResponse409.from_dict(response.json())

        return response_409

    if response.status_code == 422:
        response_422 = PostV1SubcontractsIdDeliverResponse422.from_dict(response.json())

        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1SubcontractsIdDeliverResponse200
    | PostV1SubcontractsIdDeliverResponse400
    | PostV1SubcontractsIdDeliverResponse401
    | PostV1SubcontractsIdDeliverResponse403
    | PostV1SubcontractsIdDeliverResponse404
    | PostV1SubcontractsIdDeliverResponse409
    | PostV1SubcontractsIdDeliverResponse422
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
    body: PostV1SubcontractsIdDeliverBody,
) -> Response[
    PostV1SubcontractsIdDeliverResponse200
    | PostV1SubcontractsIdDeliverResponse400
    | PostV1SubcontractsIdDeliverResponse401
    | PostV1SubcontractsIdDeliverResponse403
    | PostV1SubcontractsIdDeliverResponse404
    | PostV1SubcontractsIdDeliverResponse409
    | PostV1SubcontractsIdDeliverResponse422
]:
    """Deliver an open job (worker)

     Text, at most 64 KB. 409 `deadline_passed` after deliver-by (the job expires and the hold goes
    back). The hirer has 2 hours to accept or reject; then it is accepted with rating 5.

    Args:
        id (str):
        body (PostV1SubcontractsIdDeliverBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1SubcontractsIdDeliverResponse200 | PostV1SubcontractsIdDeliverResponse400 | PostV1SubcontractsIdDeliverResponse401 | PostV1SubcontractsIdDeliverResponse403 | PostV1SubcontractsIdDeliverResponse404 | PostV1SubcontractsIdDeliverResponse409 | PostV1SubcontractsIdDeliverResponse422]
    """

    kwargs = _get_kwargs(
        id=id,
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    id: str,
    *,
    client: AuthenticatedClient,
    body: PostV1SubcontractsIdDeliverBody,
) -> (
    PostV1SubcontractsIdDeliverResponse200
    | PostV1SubcontractsIdDeliverResponse400
    | PostV1SubcontractsIdDeliverResponse401
    | PostV1SubcontractsIdDeliverResponse403
    | PostV1SubcontractsIdDeliverResponse404
    | PostV1SubcontractsIdDeliverResponse409
    | PostV1SubcontractsIdDeliverResponse422
    | None
):
    """Deliver an open job (worker)

     Text, at most 64 KB. 409 `deadline_passed` after deliver-by (the job expires and the hold goes
    back). The hirer has 2 hours to accept or reject; then it is accepted with rating 5.

    Args:
        id (str):
        body (PostV1SubcontractsIdDeliverBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1SubcontractsIdDeliverResponse200 | PostV1SubcontractsIdDeliverResponse400 | PostV1SubcontractsIdDeliverResponse401 | PostV1SubcontractsIdDeliverResponse403 | PostV1SubcontractsIdDeliverResponse404 | PostV1SubcontractsIdDeliverResponse409 | PostV1SubcontractsIdDeliverResponse422
    """

    return sync_detailed(
        id=id,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient,
    body: PostV1SubcontractsIdDeliverBody,
) -> Response[
    PostV1SubcontractsIdDeliverResponse200
    | PostV1SubcontractsIdDeliverResponse400
    | PostV1SubcontractsIdDeliverResponse401
    | PostV1SubcontractsIdDeliverResponse403
    | PostV1SubcontractsIdDeliverResponse404
    | PostV1SubcontractsIdDeliverResponse409
    | PostV1SubcontractsIdDeliverResponse422
]:
    """Deliver an open job (worker)

     Text, at most 64 KB. 409 `deadline_passed` after deliver-by (the job expires and the hold goes
    back). The hirer has 2 hours to accept or reject; then it is accepted with rating 5.

    Args:
        id (str):
        body (PostV1SubcontractsIdDeliverBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1SubcontractsIdDeliverResponse200 | PostV1SubcontractsIdDeliverResponse400 | PostV1SubcontractsIdDeliverResponse401 | PostV1SubcontractsIdDeliverResponse403 | PostV1SubcontractsIdDeliverResponse404 | PostV1SubcontractsIdDeliverResponse409 | PostV1SubcontractsIdDeliverResponse422]
    """

    kwargs = _get_kwargs(
        id=id,
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient,
    body: PostV1SubcontractsIdDeliverBody,
) -> (
    PostV1SubcontractsIdDeliverResponse200
    | PostV1SubcontractsIdDeliverResponse400
    | PostV1SubcontractsIdDeliverResponse401
    | PostV1SubcontractsIdDeliverResponse403
    | PostV1SubcontractsIdDeliverResponse404
    | PostV1SubcontractsIdDeliverResponse409
    | PostV1SubcontractsIdDeliverResponse422
    | None
):
    """Deliver an open job (worker)

     Text, at most 64 KB. 409 `deadline_passed` after deliver-by (the job expires and the hold goes
    back). The hirer has 2 hours to accept or reject; then it is accepted with rating 5.

    Args:
        id (str):
        body (PostV1SubcontractsIdDeliverBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1SubcontractsIdDeliverResponse200 | PostV1SubcontractsIdDeliverResponse400 | PostV1SubcontractsIdDeliverResponse401 | PostV1SubcontractsIdDeliverResponse403 | PostV1SubcontractsIdDeliverResponse404 | PostV1SubcontractsIdDeliverResponse409 | PostV1SubcontractsIdDeliverResponse422
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
            body=body,
        )
    ).parsed
