from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_agents_body import PostV1AgentsBody
from ...models.post_v1_agents_response_201 import PostV1AgentsResponse201
from ...models.post_v1_agents_response_400 import PostV1AgentsResponse400
from ...models.post_v1_agents_response_401 import PostV1AgentsResponse401
from ...models.post_v1_agents_response_403 import PostV1AgentsResponse403
from ...models.post_v1_agents_response_409 import PostV1AgentsResponse409
from ...models.post_v1_agents_response_422 import PostV1AgentsResponse422
from typing import cast


def _get_kwargs(
    *,
    body: PostV1AgentsBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/agents",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    PostV1AgentsResponse201
    | PostV1AgentsResponse400
    | PostV1AgentsResponse401
    | PostV1AgentsResponse403
    | PostV1AgentsResponse409
    | PostV1AgentsResponse422
    | None
):
    if response.status_code == 201:
        response_201 = PostV1AgentsResponse201.from_dict(response.json())

        return response_201

    if response.status_code == 400:
        response_400 = PostV1AgentsResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1AgentsResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1AgentsResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 409:
        response_409 = PostV1AgentsResponse409.from_dict(response.json())

        return response_409

    if response.status_code == 422:
        response_422 = PostV1AgentsResponse422.from_dict(response.json())

        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1AgentsResponse201
    | PostV1AgentsResponse400
    | PostV1AgentsResponse401
    | PostV1AgentsResponse403
    | PostV1AgentsResponse409
    | PostV1AgentsResponse422
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
    body: PostV1AgentsBody,
) -> Response[
    PostV1AgentsResponse201
    | PostV1AgentsResponse400
    | PostV1AgentsResponse401
    | PostV1AgentsResponse403
    | PostV1AgentsResponse409
    | PostV1AgentsResponse422
]:
    """Create an agent and its API key

     Returns the plaintext API key once. An idempotent replay returns `apiKey: null`.

    Args:
        body (PostV1AgentsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AgentsResponse201 | PostV1AgentsResponse400 | PostV1AgentsResponse401 | PostV1AgentsResponse403 | PostV1AgentsResponse409 | PostV1AgentsResponse422]
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
    body: PostV1AgentsBody,
) -> (
    PostV1AgentsResponse201
    | PostV1AgentsResponse400
    | PostV1AgentsResponse401
    | PostV1AgentsResponse403
    | PostV1AgentsResponse409
    | PostV1AgentsResponse422
    | None
):
    """Create an agent and its API key

     Returns the plaintext API key once. An idempotent replay returns `apiKey: null`.

    Args:
        body (PostV1AgentsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AgentsResponse201 | PostV1AgentsResponse400 | PostV1AgentsResponse401 | PostV1AgentsResponse403 | PostV1AgentsResponse409 | PostV1AgentsResponse422
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: PostV1AgentsBody,
) -> Response[
    PostV1AgentsResponse201
    | PostV1AgentsResponse400
    | PostV1AgentsResponse401
    | PostV1AgentsResponse403
    | PostV1AgentsResponse409
    | PostV1AgentsResponse422
]:
    """Create an agent and its API key

     Returns the plaintext API key once. An idempotent replay returns `apiKey: null`.

    Args:
        body (PostV1AgentsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AgentsResponse201 | PostV1AgentsResponse400 | PostV1AgentsResponse401 | PostV1AgentsResponse403 | PostV1AgentsResponse409 | PostV1AgentsResponse422]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: PostV1AgentsBody,
) -> (
    PostV1AgentsResponse201
    | PostV1AgentsResponse400
    | PostV1AgentsResponse401
    | PostV1AgentsResponse403
    | PostV1AgentsResponse409
    | PostV1AgentsResponse422
    | None
):
    """Create an agent and its API key

     Returns the plaintext API key once. An idempotent replay returns `apiKey: null`.

    Args:
        body (PostV1AgentsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AgentsResponse201 | PostV1AgentsResponse400 | PostV1AgentsResponse401 | PostV1AgentsResponse403 | PostV1AgentsResponse409 | PostV1AgentsResponse422
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
