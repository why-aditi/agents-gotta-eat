from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_approvals_spend_request_id_body import PostV1ApprovalsSpendRequestIdBody
from ...models.post_v1_approvals_spend_request_id_response_200 import PostV1ApprovalsSpendRequestIdResponse200
from ...models.post_v1_approvals_spend_request_id_response_400 import PostV1ApprovalsSpendRequestIdResponse400
from ...models.post_v1_approvals_spend_request_id_response_401 import PostV1ApprovalsSpendRequestIdResponse401
from ...models.post_v1_approvals_spend_request_id_response_403 import PostV1ApprovalsSpendRequestIdResponse403
from ...models.post_v1_approvals_spend_request_id_response_404 import PostV1ApprovalsSpendRequestIdResponse404
from ...models.post_v1_approvals_spend_request_id_response_409 import PostV1ApprovalsSpendRequestIdResponse409
from ...models.post_v1_approvals_spend_request_id_response_422 import PostV1ApprovalsSpendRequestIdResponse422
from typing import cast


def _get_kwargs(
    spend_request_id: str,
    *,
    body: PostV1ApprovalsSpendRequestIdBody,
    idempotency_key: str,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    headers["idempotency-key"] = idempotency_key

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/approvals/{spend_request_id}".format(
            spend_request_id=quote(str(spend_request_id), safe=""),
        ),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    PostV1ApprovalsSpendRequestIdResponse200
    | PostV1ApprovalsSpendRequestIdResponse400
    | PostV1ApprovalsSpendRequestIdResponse401
    | PostV1ApprovalsSpendRequestIdResponse403
    | PostV1ApprovalsSpendRequestIdResponse404
    | PostV1ApprovalsSpendRequestIdResponse409
    | PostV1ApprovalsSpendRequestIdResponse422
    | None
):
    if response.status_code == 200:
        response_200 = PostV1ApprovalsSpendRequestIdResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = PostV1ApprovalsSpendRequestIdResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1ApprovalsSpendRequestIdResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1ApprovalsSpendRequestIdResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = PostV1ApprovalsSpendRequestIdResponse404.from_dict(response.json())

        return response_404

    if response.status_code == 409:
        response_409 = PostV1ApprovalsSpendRequestIdResponse409.from_dict(response.json())

        return response_409

    if response.status_code == 422:
        response_422 = PostV1ApprovalsSpendRequestIdResponse422.from_dict(response.json())

        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1ApprovalsSpendRequestIdResponse200
    | PostV1ApprovalsSpendRequestIdResponse400
    | PostV1ApprovalsSpendRequestIdResponse401
    | PostV1ApprovalsSpendRequestIdResponse403
    | PostV1ApprovalsSpendRequestIdResponse404
    | PostV1ApprovalsSpendRequestIdResponse409
    | PostV1ApprovalsSpendRequestIdResponse422
]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    spend_request_id: str,
    *,
    client: AuthenticatedClient,
    body: PostV1ApprovalsSpendRequestIdBody,
    idempotency_key: str,
) -> Response[
    PostV1ApprovalsSpendRequestIdResponse200
    | PostV1ApprovalsSpendRequestIdResponse400
    | PostV1ApprovalsSpendRequestIdResponse401
    | PostV1ApprovalsSpendRequestIdResponse403
    | PostV1ApprovalsSpendRequestIdResponse404
    | PostV1ApprovalsSpendRequestIdResponse409
    | PostV1ApprovalsSpendRequestIdResponse422
]:
    """Approve or deny a pending spend request

     409 `approval_expired` once the 15 minute window has passed; 409 `already_decided` otherwise.

    Args:
        spend_request_id (str):
        idempotency_key (str):
        body (PostV1ApprovalsSpendRequestIdBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1ApprovalsSpendRequestIdResponse200 | PostV1ApprovalsSpendRequestIdResponse400 | PostV1ApprovalsSpendRequestIdResponse401 | PostV1ApprovalsSpendRequestIdResponse403 | PostV1ApprovalsSpendRequestIdResponse404 | PostV1ApprovalsSpendRequestIdResponse409 | PostV1ApprovalsSpendRequestIdResponse422]
    """

    kwargs = _get_kwargs(
        spend_request_id=spend_request_id,
        body=body,
        idempotency_key=idempotency_key,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    spend_request_id: str,
    *,
    client: AuthenticatedClient,
    body: PostV1ApprovalsSpendRequestIdBody,
    idempotency_key: str,
) -> (
    PostV1ApprovalsSpendRequestIdResponse200
    | PostV1ApprovalsSpendRequestIdResponse400
    | PostV1ApprovalsSpendRequestIdResponse401
    | PostV1ApprovalsSpendRequestIdResponse403
    | PostV1ApprovalsSpendRequestIdResponse404
    | PostV1ApprovalsSpendRequestIdResponse409
    | PostV1ApprovalsSpendRequestIdResponse422
    | None
):
    """Approve or deny a pending spend request

     409 `approval_expired` once the 15 minute window has passed; 409 `already_decided` otherwise.

    Args:
        spend_request_id (str):
        idempotency_key (str):
        body (PostV1ApprovalsSpendRequestIdBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1ApprovalsSpendRequestIdResponse200 | PostV1ApprovalsSpendRequestIdResponse400 | PostV1ApprovalsSpendRequestIdResponse401 | PostV1ApprovalsSpendRequestIdResponse403 | PostV1ApprovalsSpendRequestIdResponse404 | PostV1ApprovalsSpendRequestIdResponse409 | PostV1ApprovalsSpendRequestIdResponse422
    """

    return sync_detailed(
        spend_request_id=spend_request_id,
        client=client,
        body=body,
        idempotency_key=idempotency_key,
    ).parsed


async def asyncio_detailed(
    spend_request_id: str,
    *,
    client: AuthenticatedClient,
    body: PostV1ApprovalsSpendRequestIdBody,
    idempotency_key: str,
) -> Response[
    PostV1ApprovalsSpendRequestIdResponse200
    | PostV1ApprovalsSpendRequestIdResponse400
    | PostV1ApprovalsSpendRequestIdResponse401
    | PostV1ApprovalsSpendRequestIdResponse403
    | PostV1ApprovalsSpendRequestIdResponse404
    | PostV1ApprovalsSpendRequestIdResponse409
    | PostV1ApprovalsSpendRequestIdResponse422
]:
    """Approve or deny a pending spend request

     409 `approval_expired` once the 15 minute window has passed; 409 `already_decided` otherwise.

    Args:
        spend_request_id (str):
        idempotency_key (str):
        body (PostV1ApprovalsSpendRequestIdBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1ApprovalsSpendRequestIdResponse200 | PostV1ApprovalsSpendRequestIdResponse400 | PostV1ApprovalsSpendRequestIdResponse401 | PostV1ApprovalsSpendRequestIdResponse403 | PostV1ApprovalsSpendRequestIdResponse404 | PostV1ApprovalsSpendRequestIdResponse409 | PostV1ApprovalsSpendRequestIdResponse422]
    """

    kwargs = _get_kwargs(
        spend_request_id=spend_request_id,
        body=body,
        idempotency_key=idempotency_key,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    spend_request_id: str,
    *,
    client: AuthenticatedClient,
    body: PostV1ApprovalsSpendRequestIdBody,
    idempotency_key: str,
) -> (
    PostV1ApprovalsSpendRequestIdResponse200
    | PostV1ApprovalsSpendRequestIdResponse400
    | PostV1ApprovalsSpendRequestIdResponse401
    | PostV1ApprovalsSpendRequestIdResponse403
    | PostV1ApprovalsSpendRequestIdResponse404
    | PostV1ApprovalsSpendRequestIdResponse409
    | PostV1ApprovalsSpendRequestIdResponse422
    | None
):
    """Approve or deny a pending spend request

     409 `approval_expired` once the 15 minute window has passed; 409 `already_decided` otherwise.

    Args:
        spend_request_id (str):
        idempotency_key (str):
        body (PostV1ApprovalsSpendRequestIdBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1ApprovalsSpendRequestIdResponse200 | PostV1ApprovalsSpendRequestIdResponse400 | PostV1ApprovalsSpendRequestIdResponse401 | PostV1ApprovalsSpendRequestIdResponse403 | PostV1ApprovalsSpendRequestIdResponse404 | PostV1ApprovalsSpendRequestIdResponse409 | PostV1ApprovalsSpendRequestIdResponse422
    """

    return (
        await asyncio_detailed(
            spend_request_id=spend_request_id,
            client=client,
            body=body,
            idempotency_key=idempotency_key,
        )
    ).parsed
