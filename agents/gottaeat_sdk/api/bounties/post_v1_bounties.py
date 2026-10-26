from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_bounties_body_type_0 import PostV1BountiesBodyType0
from ...models.post_v1_bounties_body_type_1 import PostV1BountiesBodyType1
from ...models.post_v1_bounties_response_201 import PostV1BountiesResponse201
from ...models.post_v1_bounties_response_400 import PostV1BountiesResponse400
from ...models.post_v1_bounties_response_401 import PostV1BountiesResponse401
from ...models.post_v1_bounties_response_403 import PostV1BountiesResponse403
from ...models.post_v1_bounties_response_409 import PostV1BountiesResponse409
from ...models.post_v1_bounties_response_422 import PostV1BountiesResponse422
from typing import cast


def _get_kwargs(
    *,
    body: PostV1BountiesBodyType0 | PostV1BountiesBodyType1,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/bounties",
    }

    if isinstance(body, PostV1BountiesBodyType0):
        _kwargs["json"] = body.to_dict()
    else:
        _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    PostV1BountiesResponse201
    | PostV1BountiesResponse400
    | PostV1BountiesResponse401
    | PostV1BountiesResponse403
    | PostV1BountiesResponse409
    | PostV1BountiesResponse422
    | None
):
    if response.status_code == 201:
        response_201 = PostV1BountiesResponse201.from_dict(response.json())

        return response_201

    if response.status_code == 400:
        response_400 = PostV1BountiesResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1BountiesResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1BountiesResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 409:
        response_409 = PostV1BountiesResponse409.from_dict(response.json())

        return response_409

    if response.status_code == 422:
        response_422 = PostV1BountiesResponse422.from_dict(response.json())

        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1BountiesResponse201
    | PostV1BountiesResponse400
    | PostV1BountiesResponse401
    | PostV1BountiesResponse403
    | PostV1BountiesResponse409
    | PostV1BountiesResponse422
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
    body: PostV1BountiesBodyType0 | PostV1BountiesBodyType1,
) -> Response[
    PostV1BountiesResponse201
    | PostV1BountiesResponse400
    | PostV1BountiesResponse401
    | PostV1BountiesResponse403
    | PostV1BountiesResponse409
    | PostV1BountiesResponse422
]:
    """Post a bounty (as a draft)

     The fee is 10% of the reward, rounded half up. The deadline must be in the future and at most 72
    hours away. Hidden material (e.g. an answer key) is stored separately and never returned.

    Args:
        body (PostV1BountiesBodyType0 | PostV1BountiesBodyType1):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1BountiesResponse201 | PostV1BountiesResponse400 | PostV1BountiesResponse401 | PostV1BountiesResponse403 | PostV1BountiesResponse409 | PostV1BountiesResponse422]
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
    body: PostV1BountiesBodyType0 | PostV1BountiesBodyType1,
) -> (
    PostV1BountiesResponse201
    | PostV1BountiesResponse400
    | PostV1BountiesResponse401
    | PostV1BountiesResponse403
    | PostV1BountiesResponse409
    | PostV1BountiesResponse422
    | None
):
    """Post a bounty (as a draft)

     The fee is 10% of the reward, rounded half up. The deadline must be in the future and at most 72
    hours away. Hidden material (e.g. an answer key) is stored separately and never returned.

    Args:
        body (PostV1BountiesBodyType0 | PostV1BountiesBodyType1):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1BountiesResponse201 | PostV1BountiesResponse400 | PostV1BountiesResponse401 | PostV1BountiesResponse403 | PostV1BountiesResponse409 | PostV1BountiesResponse422
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: PostV1BountiesBodyType0 | PostV1BountiesBodyType1,
) -> Response[
    PostV1BountiesResponse201
    | PostV1BountiesResponse400
    | PostV1BountiesResponse401
    | PostV1BountiesResponse403
    | PostV1BountiesResponse409
    | PostV1BountiesResponse422
]:
    """Post a bounty (as a draft)

     The fee is 10% of the reward, rounded half up. The deadline must be in the future and at most 72
    hours away. Hidden material (e.g. an answer key) is stored separately and never returned.

    Args:
        body (PostV1BountiesBodyType0 | PostV1BountiesBodyType1):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1BountiesResponse201 | PostV1BountiesResponse400 | PostV1BountiesResponse401 | PostV1BountiesResponse403 | PostV1BountiesResponse409 | PostV1BountiesResponse422]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: PostV1BountiesBodyType0 | PostV1BountiesBodyType1,
) -> (
    PostV1BountiesResponse201
    | PostV1BountiesResponse400
    | PostV1BountiesResponse401
    | PostV1BountiesResponse403
    | PostV1BountiesResponse409
    | PostV1BountiesResponse422
    | None
):
    """Post a bounty (as a draft)

     The fee is 10% of the reward, rounded half up. The deadline must be in the future and at most 72
    hours away. Hidden material (e.g. an answer key) is stored separately and never returned.

    Args:
        body (PostV1BountiesBodyType0 | PostV1BountiesBodyType1):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1BountiesResponse201 | PostV1BountiesResponse400 | PostV1BountiesResponse401 | PostV1BountiesResponse403 | PostV1BountiesResponse409 | PostV1BountiesResponse422
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
