from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_admin_recordings_start_body import PostV1AdminRecordingsStartBody
from ...models.post_v1_admin_recordings_start_response_201 import PostV1AdminRecordingsStartResponse201
from ...models.post_v1_admin_recordings_start_response_400 import PostV1AdminRecordingsStartResponse400
from ...models.post_v1_admin_recordings_start_response_401 import PostV1AdminRecordingsStartResponse401
from ...models.post_v1_admin_recordings_start_response_403 import PostV1AdminRecordingsStartResponse403
from ...models.post_v1_admin_recordings_start_response_409 import PostV1AdminRecordingsStartResponse409
from typing import cast


def _get_kwargs(
    *,
    body: PostV1AdminRecordingsStartBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/admin/recordings/start",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    PostV1AdminRecordingsStartResponse201
    | PostV1AdminRecordingsStartResponse400
    | PostV1AdminRecordingsStartResponse401
    | PostV1AdminRecordingsStartResponse403
    | PostV1AdminRecordingsStartResponse409
    | None
):
    if response.status_code == 201:
        response_201 = PostV1AdminRecordingsStartResponse201.from_dict(response.json())

        return response_201

    if response.status_code == 400:
        response_400 = PostV1AdminRecordingsStartResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1AdminRecordingsStartResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1AdminRecordingsStartResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 409:
        response_409 = PostV1AdminRecordingsStartResponse409.from_dict(response.json())

        return response_409

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1AdminRecordingsStartResponse201
    | PostV1AdminRecordingsStartResponse400
    | PostV1AdminRecordingsStartResponse401
    | PostV1AdminRecordingsStartResponse403
    | PostV1AdminRecordingsStartResponse409
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
    body: PostV1AdminRecordingsStartBody,
) -> Response[
    PostV1AdminRecordingsStartResponse201
    | PostV1AdminRecordingsStartResponse400
    | PostV1AdminRecordingsStartResponse401
    | PostV1AdminRecordingsStartResponse403
    | PostV1AdminRecordingsStartResponse409
]:
    """Start recording public events

     Admins only. Every public event from now until stop is saved with its offset. One recording at a
    time: 409 `recording_active` while one is running. Owner-scoped events are never recorded.

    Args:
        body (PostV1AdminRecordingsStartBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AdminRecordingsStartResponse201 | PostV1AdminRecordingsStartResponse400 | PostV1AdminRecordingsStartResponse401 | PostV1AdminRecordingsStartResponse403 | PostV1AdminRecordingsStartResponse409]
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
    body: PostV1AdminRecordingsStartBody,
) -> (
    PostV1AdminRecordingsStartResponse201
    | PostV1AdminRecordingsStartResponse400
    | PostV1AdminRecordingsStartResponse401
    | PostV1AdminRecordingsStartResponse403
    | PostV1AdminRecordingsStartResponse409
    | None
):
    """Start recording public events

     Admins only. Every public event from now until stop is saved with its offset. One recording at a
    time: 409 `recording_active` while one is running. Owner-scoped events are never recorded.

    Args:
        body (PostV1AdminRecordingsStartBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AdminRecordingsStartResponse201 | PostV1AdminRecordingsStartResponse400 | PostV1AdminRecordingsStartResponse401 | PostV1AdminRecordingsStartResponse403 | PostV1AdminRecordingsStartResponse409
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: PostV1AdminRecordingsStartBody,
) -> Response[
    PostV1AdminRecordingsStartResponse201
    | PostV1AdminRecordingsStartResponse400
    | PostV1AdminRecordingsStartResponse401
    | PostV1AdminRecordingsStartResponse403
    | PostV1AdminRecordingsStartResponse409
]:
    """Start recording public events

     Admins only. Every public event from now until stop is saved with its offset. One recording at a
    time: 409 `recording_active` while one is running. Owner-scoped events are never recorded.

    Args:
        body (PostV1AdminRecordingsStartBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AdminRecordingsStartResponse201 | PostV1AdminRecordingsStartResponse400 | PostV1AdminRecordingsStartResponse401 | PostV1AdminRecordingsStartResponse403 | PostV1AdminRecordingsStartResponse409]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: PostV1AdminRecordingsStartBody,
) -> (
    PostV1AdminRecordingsStartResponse201
    | PostV1AdminRecordingsStartResponse400
    | PostV1AdminRecordingsStartResponse401
    | PostV1AdminRecordingsStartResponse403
    | PostV1AdminRecordingsStartResponse409
    | None
):
    """Start recording public events

     Admins only. Every public event from now until stop is saved with its offset. One recording at a
    time: 409 `recording_active` while one is running. Owner-scoped events are never recorded.

    Args:
        body (PostV1AdminRecordingsStartBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AdminRecordingsStartResponse201 | PostV1AdminRecordingsStartResponse400 | PostV1AdminRecordingsStartResponse401 | PostV1AdminRecordingsStartResponse403 | PostV1AdminRecordingsStartResponse409
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
