from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_admin_recordings_window_body import PostV1AdminRecordingsWindowBody
from ...models.post_v1_admin_recordings_window_response_201 import PostV1AdminRecordingsWindowResponse201
from ...models.post_v1_admin_recordings_window_response_400 import PostV1AdminRecordingsWindowResponse400
from ...models.post_v1_admin_recordings_window_response_401 import PostV1AdminRecordingsWindowResponse401
from ...models.post_v1_admin_recordings_window_response_403 import PostV1AdminRecordingsWindowResponse403
from typing import cast


def _get_kwargs(
    *,
    body: PostV1AdminRecordingsWindowBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/admin/recordings/window",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    PostV1AdminRecordingsWindowResponse201
    | PostV1AdminRecordingsWindowResponse400
    | PostV1AdminRecordingsWindowResponse401
    | PostV1AdminRecordingsWindowResponse403
    | None
):
    if response.status_code == 201:
        response_201 = PostV1AdminRecordingsWindowResponse201.from_dict(response.json())

        return response_201

    if response.status_code == 400:
        response_400 = PostV1AdminRecordingsWindowResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1AdminRecordingsWindowResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1AdminRecordingsWindowResponse403.from_dict(response.json())

        return response_403

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1AdminRecordingsWindowResponse201
    | PostV1AdminRecordingsWindowResponse400
    | PostV1AdminRecordingsWindowResponse401
    | PostV1AdminRecordingsWindowResponse403
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
    body: PostV1AdminRecordingsWindowBody,
) -> Response[
    PostV1AdminRecordingsWindowResponse201
    | PostV1AdminRecordingsWindowResponse400
    | PostV1AdminRecordingsWindowResponse401
    | PostV1AdminRecordingsWindowResponse403
]:
    """Save a finished recording from events already stored

     Admins only. Copies the public events between `from` and `to` (events are kept 30 days) into a new,
    finished recording.

    Args:
        body (PostV1AdminRecordingsWindowBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AdminRecordingsWindowResponse201 | PostV1AdminRecordingsWindowResponse400 | PostV1AdminRecordingsWindowResponse401 | PostV1AdminRecordingsWindowResponse403]
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
    body: PostV1AdminRecordingsWindowBody,
) -> (
    PostV1AdminRecordingsWindowResponse201
    | PostV1AdminRecordingsWindowResponse400
    | PostV1AdminRecordingsWindowResponse401
    | PostV1AdminRecordingsWindowResponse403
    | None
):
    """Save a finished recording from events already stored

     Admins only. Copies the public events between `from` and `to` (events are kept 30 days) into a new,
    finished recording.

    Args:
        body (PostV1AdminRecordingsWindowBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AdminRecordingsWindowResponse201 | PostV1AdminRecordingsWindowResponse400 | PostV1AdminRecordingsWindowResponse401 | PostV1AdminRecordingsWindowResponse403
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: PostV1AdminRecordingsWindowBody,
) -> Response[
    PostV1AdminRecordingsWindowResponse201
    | PostV1AdminRecordingsWindowResponse400
    | PostV1AdminRecordingsWindowResponse401
    | PostV1AdminRecordingsWindowResponse403
]:
    """Save a finished recording from events already stored

     Admins only. Copies the public events between `from` and `to` (events are kept 30 days) into a new,
    finished recording.

    Args:
        body (PostV1AdminRecordingsWindowBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AdminRecordingsWindowResponse201 | PostV1AdminRecordingsWindowResponse400 | PostV1AdminRecordingsWindowResponse401 | PostV1AdminRecordingsWindowResponse403]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: PostV1AdminRecordingsWindowBody,
) -> (
    PostV1AdminRecordingsWindowResponse201
    | PostV1AdminRecordingsWindowResponse400
    | PostV1AdminRecordingsWindowResponse401
    | PostV1AdminRecordingsWindowResponse403
    | None
):
    """Save a finished recording from events already stored

     Admins only. Copies the public events between `from` and `to` (events are kept 30 days) into a new,
    finished recording.

    Args:
        body (PostV1AdminRecordingsWindowBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AdminRecordingsWindowResponse201 | PostV1AdminRecordingsWindowResponse400 | PostV1AdminRecordingsWindowResponse401 | PostV1AdminRecordingsWindowResponse403
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
