from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_admin_recordings_stop_response_200 import PostV1AdminRecordingsStopResponse200
from ...models.post_v1_admin_recordings_stop_response_401 import PostV1AdminRecordingsStopResponse401
from ...models.post_v1_admin_recordings_stop_response_403 import PostV1AdminRecordingsStopResponse403
from ...models.post_v1_admin_recordings_stop_response_404 import PostV1AdminRecordingsStopResponse404
from typing import cast


def _get_kwargs() -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/admin/recordings/stop",
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    PostV1AdminRecordingsStopResponse200
    | PostV1AdminRecordingsStopResponse401
    | PostV1AdminRecordingsStopResponse403
    | PostV1AdminRecordingsStopResponse404
    | None
):
    if response.status_code == 200:
        response_200 = PostV1AdminRecordingsStopResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 401:
        response_401 = PostV1AdminRecordingsStopResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1AdminRecordingsStopResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = PostV1AdminRecordingsStopResponse404.from_dict(response.json())

        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1AdminRecordingsStopResponse200
    | PostV1AdminRecordingsStopResponse401
    | PostV1AdminRecordingsStopResponse403
    | PostV1AdminRecordingsStopResponse404
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
) -> Response[
    PostV1AdminRecordingsStopResponse200
    | PostV1AdminRecordingsStopResponse401
    | PostV1AdminRecordingsStopResponse403
    | PostV1AdminRecordingsStopResponse404
]:
    """Stop the active recording

     Admins only. Also copies any public event in the recording's window that the live recorder missed.
    404 when no recording is active.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AdminRecordingsStopResponse200 | PostV1AdminRecordingsStopResponse401 | PostV1AdminRecordingsStopResponse403 | PostV1AdminRecordingsStopResponse404]
    """

    kwargs = _get_kwargs()

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
) -> (
    PostV1AdminRecordingsStopResponse200
    | PostV1AdminRecordingsStopResponse401
    | PostV1AdminRecordingsStopResponse403
    | PostV1AdminRecordingsStopResponse404
    | None
):
    """Stop the active recording

     Admins only. Also copies any public event in the recording's window that the live recorder missed.
    404 when no recording is active.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AdminRecordingsStopResponse200 | PostV1AdminRecordingsStopResponse401 | PostV1AdminRecordingsStopResponse403 | PostV1AdminRecordingsStopResponse404
    """

    return sync_detailed(
        client=client,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
) -> Response[
    PostV1AdminRecordingsStopResponse200
    | PostV1AdminRecordingsStopResponse401
    | PostV1AdminRecordingsStopResponse403
    | PostV1AdminRecordingsStopResponse404
]:
    """Stop the active recording

     Admins only. Also copies any public event in the recording's window that the live recorder missed.
    404 when no recording is active.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AdminRecordingsStopResponse200 | PostV1AdminRecordingsStopResponse401 | PostV1AdminRecordingsStopResponse403 | PostV1AdminRecordingsStopResponse404]
    """

    kwargs = _get_kwargs()

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
) -> (
    PostV1AdminRecordingsStopResponse200
    | PostV1AdminRecordingsStopResponse401
    | PostV1AdminRecordingsStopResponse403
    | PostV1AdminRecordingsStopResponse404
    | None
):
    """Stop the active recording

     Admins only. Also copies any public event in the recording's window that the live recorder missed.
    404 when no recording is active.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AdminRecordingsStopResponse200 | PostV1AdminRecordingsStopResponse401 | PostV1AdminRecordingsStopResponse403 | PostV1AdminRecordingsStopResponse404
    """

    return (
        await asyncio_detailed(
            client=client,
        )
    ).parsed
