from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_bounties_id_disputes_body import PostV1BountiesIdDisputesBody
from ...models.post_v1_bounties_id_disputes_response_201 import PostV1BountiesIdDisputesResponse201
from ...models.post_v1_bounties_id_disputes_response_400 import PostV1BountiesIdDisputesResponse400
from ...models.post_v1_bounties_id_disputes_response_401 import PostV1BountiesIdDisputesResponse401
from ...models.post_v1_bounties_id_disputes_response_403 import PostV1BountiesIdDisputesResponse403
from ...models.post_v1_bounties_id_disputes_response_404 import PostV1BountiesIdDisputesResponse404
from ...models.post_v1_bounties_id_disputes_response_409 import PostV1BountiesIdDisputesResponse409
from ...models.post_v1_bounties_id_disputes_response_422 import PostV1BountiesIdDisputesResponse422
from typing import cast


def _get_kwargs(
    id: str,
    *,
    body: PostV1BountiesIdDisputesBody,
    idempotency_key: str,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    headers["idempotency-key"] = idempotency_key

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/bounties/{id}/disputes".format(
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
    PostV1BountiesIdDisputesResponse201
    | PostV1BountiesIdDisputesResponse400
    | PostV1BountiesIdDisputesResponse401
    | PostV1BountiesIdDisputesResponse403
    | PostV1BountiesIdDisputesResponse404
    | PostV1BountiesIdDisputesResponse409
    | PostV1BountiesIdDisputesResponse422
    | None
):
    if response.status_code == 201:
        response_201 = PostV1BountiesIdDisputesResponse201.from_dict(response.json())

        return response_201

    if response.status_code == 400:
        response_400 = PostV1BountiesIdDisputesResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1BountiesIdDisputesResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1BountiesIdDisputesResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = PostV1BountiesIdDisputesResponse404.from_dict(response.json())

        return response_404

    if response.status_code == 409:
        response_409 = PostV1BountiesIdDisputesResponse409.from_dict(response.json())

        return response_409

    if response.status_code == 422:
        response_422 = PostV1BountiesIdDisputesResponse422.from_dict(response.json())

        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1BountiesIdDisputesResponse201
    | PostV1BountiesIdDisputesResponse400
    | PostV1BountiesIdDisputesResponse401
    | PostV1BountiesIdDisputesResponse403
    | PostV1BountiesIdDisputesResponse404
    | PostV1BountiesIdDisputesResponse409
    | PostV1BountiesIdDisputesResponse422
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
    body: PostV1BountiesIdDisputesBody,
    idempotency_key: str,
) -> Response[
    PostV1BountiesIdDisputesResponse201
    | PostV1BountiesIdDisputesResponse400
    | PostV1BountiesIdDisputesResponse401
    | PostV1BountiesIdDisputesResponse403
    | PostV1BountiesIdDisputesResponse404
    | PostV1BountiesIdDisputesResponse409
    | PostV1BountiesIdDisputesResponse422
]:
    """Dispute the result of an auto-judged bounty

     Poster only (404 otherwise), within 12 hours of settlement (`disputeUntil` in the results). The
    winner's reward stays held until an admin upholds the result (the winner is paid) or overturns it
    (the reward goes back to the poster; the fee is kept). The reason is stored and shown as plain text.
    409 `not_disputable` for poster-judged or unsettled bounties, `dispute_exists` for a second dispute,
    `dispute_window_closed` after the window.

    Args:
        id (str):
        idempotency_key (str):
        body (PostV1BountiesIdDisputesBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1BountiesIdDisputesResponse201 | PostV1BountiesIdDisputesResponse400 | PostV1BountiesIdDisputesResponse401 | PostV1BountiesIdDisputesResponse403 | PostV1BountiesIdDisputesResponse404 | PostV1BountiesIdDisputesResponse409 | PostV1BountiesIdDisputesResponse422]
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
    body: PostV1BountiesIdDisputesBody,
    idempotency_key: str,
) -> (
    PostV1BountiesIdDisputesResponse201
    | PostV1BountiesIdDisputesResponse400
    | PostV1BountiesIdDisputesResponse401
    | PostV1BountiesIdDisputesResponse403
    | PostV1BountiesIdDisputesResponse404
    | PostV1BountiesIdDisputesResponse409
    | PostV1BountiesIdDisputesResponse422
    | None
):
    """Dispute the result of an auto-judged bounty

     Poster only (404 otherwise), within 12 hours of settlement (`disputeUntil` in the results). The
    winner's reward stays held until an admin upholds the result (the winner is paid) or overturns it
    (the reward goes back to the poster; the fee is kept). The reason is stored and shown as plain text.
    409 `not_disputable` for poster-judged or unsettled bounties, `dispute_exists` for a second dispute,
    `dispute_window_closed` after the window.

    Args:
        id (str):
        idempotency_key (str):
        body (PostV1BountiesIdDisputesBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1BountiesIdDisputesResponse201 | PostV1BountiesIdDisputesResponse400 | PostV1BountiesIdDisputesResponse401 | PostV1BountiesIdDisputesResponse403 | PostV1BountiesIdDisputesResponse404 | PostV1BountiesIdDisputesResponse409 | PostV1BountiesIdDisputesResponse422
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
    body: PostV1BountiesIdDisputesBody,
    idempotency_key: str,
) -> Response[
    PostV1BountiesIdDisputesResponse201
    | PostV1BountiesIdDisputesResponse400
    | PostV1BountiesIdDisputesResponse401
    | PostV1BountiesIdDisputesResponse403
    | PostV1BountiesIdDisputesResponse404
    | PostV1BountiesIdDisputesResponse409
    | PostV1BountiesIdDisputesResponse422
]:
    """Dispute the result of an auto-judged bounty

     Poster only (404 otherwise), within 12 hours of settlement (`disputeUntil` in the results). The
    winner's reward stays held until an admin upholds the result (the winner is paid) or overturns it
    (the reward goes back to the poster; the fee is kept). The reason is stored and shown as plain text.
    409 `not_disputable` for poster-judged or unsettled bounties, `dispute_exists` for a second dispute,
    `dispute_window_closed` after the window.

    Args:
        id (str):
        idempotency_key (str):
        body (PostV1BountiesIdDisputesBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1BountiesIdDisputesResponse201 | PostV1BountiesIdDisputesResponse400 | PostV1BountiesIdDisputesResponse401 | PostV1BountiesIdDisputesResponse403 | PostV1BountiesIdDisputesResponse404 | PostV1BountiesIdDisputesResponse409 | PostV1BountiesIdDisputesResponse422]
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
    body: PostV1BountiesIdDisputesBody,
    idempotency_key: str,
) -> (
    PostV1BountiesIdDisputesResponse201
    | PostV1BountiesIdDisputesResponse400
    | PostV1BountiesIdDisputesResponse401
    | PostV1BountiesIdDisputesResponse403
    | PostV1BountiesIdDisputesResponse404
    | PostV1BountiesIdDisputesResponse409
    | PostV1BountiesIdDisputesResponse422
    | None
):
    """Dispute the result of an auto-judged bounty

     Poster only (404 otherwise), within 12 hours of settlement (`disputeUntil` in the results). The
    winner's reward stays held until an admin upholds the result (the winner is paid) or overturns it
    (the reward goes back to the poster; the fee is kept). The reason is stored and shown as plain text.
    409 `not_disputable` for poster-judged or unsettled bounties, `dispute_exists` for a second dispute,
    `dispute_window_closed` after the window.

    Args:
        id (str):
        idempotency_key (str):
        body (PostV1BountiesIdDisputesBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1BountiesIdDisputesResponse201 | PostV1BountiesIdDisputesResponse400 | PostV1BountiesIdDisputesResponse401 | PostV1BountiesIdDisputesResponse403 | PostV1BountiesIdDisputesResponse404 | PostV1BountiesIdDisputesResponse409 | PostV1BountiesIdDisputesResponse422
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
            body=body,
            idempotency_key=idempotency_key,
        )
    ).parsed
