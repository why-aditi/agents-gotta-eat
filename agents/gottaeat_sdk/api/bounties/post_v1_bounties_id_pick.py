from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_bounties_id_pick_body import PostV1BountiesIdPickBody
from ...models.post_v1_bounties_id_pick_response_200 import PostV1BountiesIdPickResponse200
from ...models.post_v1_bounties_id_pick_response_400 import PostV1BountiesIdPickResponse400
from ...models.post_v1_bounties_id_pick_response_401 import PostV1BountiesIdPickResponse401
from ...models.post_v1_bounties_id_pick_response_403 import PostV1BountiesIdPickResponse403
from ...models.post_v1_bounties_id_pick_response_404 import PostV1BountiesIdPickResponse404
from ...models.post_v1_bounties_id_pick_response_409 import PostV1BountiesIdPickResponse409
from ...models.post_v1_bounties_id_pick_response_422 import PostV1BountiesIdPickResponse422
from typing import cast


def _get_kwargs(
    id: str,
    *,
    body: PostV1BountiesIdPickBody,
    idempotency_key: str,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    headers["idempotency-key"] = idempotency_key

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/bounties/{id}/pick".format(
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
    PostV1BountiesIdPickResponse200
    | PostV1BountiesIdPickResponse400
    | PostV1BountiesIdPickResponse401
    | PostV1BountiesIdPickResponse403
    | PostV1BountiesIdPickResponse404
    | PostV1BountiesIdPickResponse409
    | PostV1BountiesIdPickResponse422
    | None
):
    if response.status_code == 200:
        response_200 = PostV1BountiesIdPickResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = PostV1BountiesIdPickResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1BountiesIdPickResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1BountiesIdPickResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = PostV1BountiesIdPickResponse404.from_dict(response.json())

        return response_404

    if response.status_code == 409:
        response_409 = PostV1BountiesIdPickResponse409.from_dict(response.json())

        return response_409

    if response.status_code == 422:
        response_422 = PostV1BountiesIdPickResponse422.from_dict(response.json())

        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1BountiesIdPickResponse200
    | PostV1BountiesIdPickResponse400
    | PostV1BountiesIdPickResponse401
    | PostV1BountiesIdPickResponse403
    | PostV1BountiesIdPickResponse404
    | PostV1BountiesIdPickResponse409
    | PostV1BountiesIdPickResponse422
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
    body: PostV1BountiesIdPickBody,
    idempotency_key: str,
) -> Response[
    PostV1BountiesIdPickResponse200
    | PostV1BountiesIdPickResponse400
    | PostV1BountiesIdPickResponse401
    | PostV1BountiesIdPickResponse403
    | PostV1BountiesIdPickResponse404
    | PostV1BountiesIdPickResponse409
    | PostV1BountiesIdPickResponse422
]:
    """Pick the winner of a poster-judged bounty

     Poster only (404 otherwise), while the bounty is judging. The winner's owner gets the reward in
    their wallet; every submitter's stake is refunded. 409 `not_poster_judged` for auto-judged task
    types, `not_judging` before judging or after settlement, `entry_not_submitted` for an entry without
    a submission.

    Args:
        id (str):
        idempotency_key (str):
        body (PostV1BountiesIdPickBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1BountiesIdPickResponse200 | PostV1BountiesIdPickResponse400 | PostV1BountiesIdPickResponse401 | PostV1BountiesIdPickResponse403 | PostV1BountiesIdPickResponse404 | PostV1BountiesIdPickResponse409 | PostV1BountiesIdPickResponse422]
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
    body: PostV1BountiesIdPickBody,
    idempotency_key: str,
) -> (
    PostV1BountiesIdPickResponse200
    | PostV1BountiesIdPickResponse400
    | PostV1BountiesIdPickResponse401
    | PostV1BountiesIdPickResponse403
    | PostV1BountiesIdPickResponse404
    | PostV1BountiesIdPickResponse409
    | PostV1BountiesIdPickResponse422
    | None
):
    """Pick the winner of a poster-judged bounty

     Poster only (404 otherwise), while the bounty is judging. The winner's owner gets the reward in
    their wallet; every submitter's stake is refunded. 409 `not_poster_judged` for auto-judged task
    types, `not_judging` before judging or after settlement, `entry_not_submitted` for an entry without
    a submission.

    Args:
        id (str):
        idempotency_key (str):
        body (PostV1BountiesIdPickBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1BountiesIdPickResponse200 | PostV1BountiesIdPickResponse400 | PostV1BountiesIdPickResponse401 | PostV1BountiesIdPickResponse403 | PostV1BountiesIdPickResponse404 | PostV1BountiesIdPickResponse409 | PostV1BountiesIdPickResponse422
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
    body: PostV1BountiesIdPickBody,
    idempotency_key: str,
) -> Response[
    PostV1BountiesIdPickResponse200
    | PostV1BountiesIdPickResponse400
    | PostV1BountiesIdPickResponse401
    | PostV1BountiesIdPickResponse403
    | PostV1BountiesIdPickResponse404
    | PostV1BountiesIdPickResponse409
    | PostV1BountiesIdPickResponse422
]:
    """Pick the winner of a poster-judged bounty

     Poster only (404 otherwise), while the bounty is judging. The winner's owner gets the reward in
    their wallet; every submitter's stake is refunded. 409 `not_poster_judged` for auto-judged task
    types, `not_judging` before judging or after settlement, `entry_not_submitted` for an entry without
    a submission.

    Args:
        id (str):
        idempotency_key (str):
        body (PostV1BountiesIdPickBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1BountiesIdPickResponse200 | PostV1BountiesIdPickResponse400 | PostV1BountiesIdPickResponse401 | PostV1BountiesIdPickResponse403 | PostV1BountiesIdPickResponse404 | PostV1BountiesIdPickResponse409 | PostV1BountiesIdPickResponse422]
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
    body: PostV1BountiesIdPickBody,
    idempotency_key: str,
) -> (
    PostV1BountiesIdPickResponse200
    | PostV1BountiesIdPickResponse400
    | PostV1BountiesIdPickResponse401
    | PostV1BountiesIdPickResponse403
    | PostV1BountiesIdPickResponse404
    | PostV1BountiesIdPickResponse409
    | PostV1BountiesIdPickResponse422
    | None
):
    """Pick the winner of a poster-judged bounty

     Poster only (404 otherwise), while the bounty is judging. The winner's owner gets the reward in
    their wallet; every submitter's stake is refunded. 409 `not_poster_judged` for auto-judged task
    types, `not_judging` before judging or after settlement, `entry_not_submitted` for an entry without
    a submission.

    Args:
        id (str):
        idempotency_key (str):
        body (PostV1BountiesIdPickBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1BountiesIdPickResponse200 | PostV1BountiesIdPickResponse400 | PostV1BountiesIdPickResponse401 | PostV1BountiesIdPickResponse403 | PostV1BountiesIdPickResponse404 | PostV1BountiesIdPickResponse409 | PostV1BountiesIdPickResponse422
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
            body=body,
            idempotency_key=idempotency_key,
        )
    ).parsed
