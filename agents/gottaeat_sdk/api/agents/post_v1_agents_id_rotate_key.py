from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_agents_id_rotate_key_response_200 import PostV1AgentsIdRotateKeyResponse200
from ...models.post_v1_agents_id_rotate_key_response_400 import PostV1AgentsIdRotateKeyResponse400
from ...models.post_v1_agents_id_rotate_key_response_401 import PostV1AgentsIdRotateKeyResponse401
from ...models.post_v1_agents_id_rotate_key_response_403 import PostV1AgentsIdRotateKeyResponse403
from ...models.post_v1_agents_id_rotate_key_response_404 import PostV1AgentsIdRotateKeyResponse404
from ...models.post_v1_agents_id_rotate_key_response_409 import PostV1AgentsIdRotateKeyResponse409
from ...models.post_v1_agents_id_rotate_key_response_422 import PostV1AgentsIdRotateKeyResponse422
from typing import cast


def _get_kwargs(
    id: str,
    *,
    idempotency_key: str,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    headers["idempotency-key"] = idempotency_key

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/agents/{id}/rotate-key".format(
            id=quote(str(id), safe=""),
        ),
    }

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    PostV1AgentsIdRotateKeyResponse200
    | PostV1AgentsIdRotateKeyResponse400
    | PostV1AgentsIdRotateKeyResponse401
    | PostV1AgentsIdRotateKeyResponse403
    | PostV1AgentsIdRotateKeyResponse404
    | PostV1AgentsIdRotateKeyResponse409
    | PostV1AgentsIdRotateKeyResponse422
    | None
):
    if response.status_code == 200:
        response_200 = PostV1AgentsIdRotateKeyResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = PostV1AgentsIdRotateKeyResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1AgentsIdRotateKeyResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1AgentsIdRotateKeyResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = PostV1AgentsIdRotateKeyResponse404.from_dict(response.json())

        return response_404

    if response.status_code == 409:
        response_409 = PostV1AgentsIdRotateKeyResponse409.from_dict(response.json())

        return response_409

    if response.status_code == 422:
        response_422 = PostV1AgentsIdRotateKeyResponse422.from_dict(response.json())

        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1AgentsIdRotateKeyResponse200
    | PostV1AgentsIdRotateKeyResponse400
    | PostV1AgentsIdRotateKeyResponse401
    | PostV1AgentsIdRotateKeyResponse403
    | PostV1AgentsIdRotateKeyResponse404
    | PostV1AgentsIdRotateKeyResponse409
    | PostV1AgentsIdRotateKeyResponse422
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
    idempotency_key: str,
) -> Response[
    PostV1AgentsIdRotateKeyResponse200
    | PostV1AgentsIdRotateKeyResponse400
    | PostV1AgentsIdRotateKeyResponse401
    | PostV1AgentsIdRotateKeyResponse403
    | PostV1AgentsIdRotateKeyResponse404
    | PostV1AgentsIdRotateKeyResponse409
    | PostV1AgentsIdRotateKeyResponse422
]:
    """Replace an agent's API key

     The old key stops working at once. Also restores a revoked key. An idempotent replay returns
    `apiKey: null`.

    Args:
        id (str):
        idempotency_key (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AgentsIdRotateKeyResponse200 | PostV1AgentsIdRotateKeyResponse400 | PostV1AgentsIdRotateKeyResponse401 | PostV1AgentsIdRotateKeyResponse403 | PostV1AgentsIdRotateKeyResponse404 | PostV1AgentsIdRotateKeyResponse409 | PostV1AgentsIdRotateKeyResponse422]
    """

    kwargs = _get_kwargs(
        id=id,
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
    idempotency_key: str,
) -> (
    PostV1AgentsIdRotateKeyResponse200
    | PostV1AgentsIdRotateKeyResponse400
    | PostV1AgentsIdRotateKeyResponse401
    | PostV1AgentsIdRotateKeyResponse403
    | PostV1AgentsIdRotateKeyResponse404
    | PostV1AgentsIdRotateKeyResponse409
    | PostV1AgentsIdRotateKeyResponse422
    | None
):
    """Replace an agent's API key

     The old key stops working at once. Also restores a revoked key. An idempotent replay returns
    `apiKey: null`.

    Args:
        id (str):
        idempotency_key (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AgentsIdRotateKeyResponse200 | PostV1AgentsIdRotateKeyResponse400 | PostV1AgentsIdRotateKeyResponse401 | PostV1AgentsIdRotateKeyResponse403 | PostV1AgentsIdRotateKeyResponse404 | PostV1AgentsIdRotateKeyResponse409 | PostV1AgentsIdRotateKeyResponse422
    """

    return sync_detailed(
        id=id,
        client=client,
        idempotency_key=idempotency_key,
    ).parsed


async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient,
    idempotency_key: str,
) -> Response[
    PostV1AgentsIdRotateKeyResponse200
    | PostV1AgentsIdRotateKeyResponse400
    | PostV1AgentsIdRotateKeyResponse401
    | PostV1AgentsIdRotateKeyResponse403
    | PostV1AgentsIdRotateKeyResponse404
    | PostV1AgentsIdRotateKeyResponse409
    | PostV1AgentsIdRotateKeyResponse422
]:
    """Replace an agent's API key

     The old key stops working at once. Also restores a revoked key. An idempotent replay returns
    `apiKey: null`.

    Args:
        id (str):
        idempotency_key (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AgentsIdRotateKeyResponse200 | PostV1AgentsIdRotateKeyResponse400 | PostV1AgentsIdRotateKeyResponse401 | PostV1AgentsIdRotateKeyResponse403 | PostV1AgentsIdRotateKeyResponse404 | PostV1AgentsIdRotateKeyResponse409 | PostV1AgentsIdRotateKeyResponse422]
    """

    kwargs = _get_kwargs(
        id=id,
        idempotency_key=idempotency_key,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient,
    idempotency_key: str,
) -> (
    PostV1AgentsIdRotateKeyResponse200
    | PostV1AgentsIdRotateKeyResponse400
    | PostV1AgentsIdRotateKeyResponse401
    | PostV1AgentsIdRotateKeyResponse403
    | PostV1AgentsIdRotateKeyResponse404
    | PostV1AgentsIdRotateKeyResponse409
    | PostV1AgentsIdRotateKeyResponse422
    | None
):
    """Replace an agent's API key

     The old key stops working at once. Also restores a revoked key. An idempotent replay returns
    `apiKey: null`.

    Args:
        id (str):
        idempotency_key (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AgentsIdRotateKeyResponse200 | PostV1AgentsIdRotateKeyResponse400 | PostV1AgentsIdRotateKeyResponse401 | PostV1AgentsIdRotateKeyResponse403 | PostV1AgentsIdRotateKeyResponse404 | PostV1AgentsIdRotateKeyResponse409 | PostV1AgentsIdRotateKeyResponse422
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
            idempotency_key=idempotency_key,
        )
    ).parsed
