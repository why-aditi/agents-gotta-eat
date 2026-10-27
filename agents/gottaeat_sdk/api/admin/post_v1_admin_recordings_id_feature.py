from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_admin_recordings_id_feature_response_200 import PostV1AdminRecordingsIdFeatureResponse200
from ...models.post_v1_admin_recordings_id_feature_response_400 import PostV1AdminRecordingsIdFeatureResponse400
from ...models.post_v1_admin_recordings_id_feature_response_401 import PostV1AdminRecordingsIdFeatureResponse401
from ...models.post_v1_admin_recordings_id_feature_response_403 import PostV1AdminRecordingsIdFeatureResponse403
from ...models.post_v1_admin_recordings_id_feature_response_404 import PostV1AdminRecordingsIdFeatureResponse404
from ...models.post_v1_admin_recordings_id_feature_response_409 import PostV1AdminRecordingsIdFeatureResponse409
from typing import cast


def _get_kwargs(
    id: str,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/admin/recordings/{id}/feature".format(
            id=quote(str(id), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    PostV1AdminRecordingsIdFeatureResponse200
    | PostV1AdminRecordingsIdFeatureResponse400
    | PostV1AdminRecordingsIdFeatureResponse401
    | PostV1AdminRecordingsIdFeatureResponse403
    | PostV1AdminRecordingsIdFeatureResponse404
    | PostV1AdminRecordingsIdFeatureResponse409
    | None
):
    if response.status_code == 200:
        response_200 = PostV1AdminRecordingsIdFeatureResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = PostV1AdminRecordingsIdFeatureResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1AdminRecordingsIdFeatureResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1AdminRecordingsIdFeatureResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = PostV1AdminRecordingsIdFeatureResponse404.from_dict(response.json())

        return response_404

    if response.status_code == 409:
        response_409 = PostV1AdminRecordingsIdFeatureResponse409.from_dict(response.json())

        return response_409

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1AdminRecordingsIdFeatureResponse200
    | PostV1AdminRecordingsIdFeatureResponse400
    | PostV1AdminRecordingsIdFeatureResponse401
    | PostV1AdminRecordingsIdFeatureResponse403
    | PostV1AdminRecordingsIdFeatureResponse404
    | PostV1AdminRecordingsIdFeatureResponse409
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
) -> Response[
    PostV1AdminRecordingsIdFeatureResponse200
    | PostV1AdminRecordingsIdFeatureResponse400
    | PostV1AdminRecordingsIdFeatureResponse401
    | PostV1AdminRecordingsIdFeatureResponse403
    | PostV1AdminRecordingsIdFeatureResponse404
    | PostV1AdminRecordingsIdFeatureResponse409
]:
    """Feature a recording on /demo

     Admins only. Unfeatures the previous one. 409 `recording_active` for a recording still running.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AdminRecordingsIdFeatureResponse200 | PostV1AdminRecordingsIdFeatureResponse400 | PostV1AdminRecordingsIdFeatureResponse401 | PostV1AdminRecordingsIdFeatureResponse403 | PostV1AdminRecordingsIdFeatureResponse404 | PostV1AdminRecordingsIdFeatureResponse409]
    """

    kwargs = _get_kwargs(
        id=id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    id: str,
    *,
    client: AuthenticatedClient,
) -> (
    PostV1AdminRecordingsIdFeatureResponse200
    | PostV1AdminRecordingsIdFeatureResponse400
    | PostV1AdminRecordingsIdFeatureResponse401
    | PostV1AdminRecordingsIdFeatureResponse403
    | PostV1AdminRecordingsIdFeatureResponse404
    | PostV1AdminRecordingsIdFeatureResponse409
    | None
):
    """Feature a recording on /demo

     Admins only. Unfeatures the previous one. 409 `recording_active` for a recording still running.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AdminRecordingsIdFeatureResponse200 | PostV1AdminRecordingsIdFeatureResponse400 | PostV1AdminRecordingsIdFeatureResponse401 | PostV1AdminRecordingsIdFeatureResponse403 | PostV1AdminRecordingsIdFeatureResponse404 | PostV1AdminRecordingsIdFeatureResponse409
    """

    return sync_detailed(
        id=id,
        client=client,
    ).parsed


async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient,
) -> Response[
    PostV1AdminRecordingsIdFeatureResponse200
    | PostV1AdminRecordingsIdFeatureResponse400
    | PostV1AdminRecordingsIdFeatureResponse401
    | PostV1AdminRecordingsIdFeatureResponse403
    | PostV1AdminRecordingsIdFeatureResponse404
    | PostV1AdminRecordingsIdFeatureResponse409
]:
    """Feature a recording on /demo

     Admins only. Unfeatures the previous one. 409 `recording_active` for a recording still running.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AdminRecordingsIdFeatureResponse200 | PostV1AdminRecordingsIdFeatureResponse400 | PostV1AdminRecordingsIdFeatureResponse401 | PostV1AdminRecordingsIdFeatureResponse403 | PostV1AdminRecordingsIdFeatureResponse404 | PostV1AdminRecordingsIdFeatureResponse409]
    """

    kwargs = _get_kwargs(
        id=id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient,
) -> (
    PostV1AdminRecordingsIdFeatureResponse200
    | PostV1AdminRecordingsIdFeatureResponse400
    | PostV1AdminRecordingsIdFeatureResponse401
    | PostV1AdminRecordingsIdFeatureResponse403
    | PostV1AdminRecordingsIdFeatureResponse404
    | PostV1AdminRecordingsIdFeatureResponse409
    | None
):
    """Feature a recording on /demo

     Admins only. Unfeatures the previous one. 409 `recording_active` for a recording still running.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AdminRecordingsIdFeatureResponse200 | PostV1AdminRecordingsIdFeatureResponse400 | PostV1AdminRecordingsIdFeatureResponse401 | PostV1AdminRecordingsIdFeatureResponse403 | PostV1AdminRecordingsIdFeatureResponse404 | PostV1AdminRecordingsIdFeatureResponse409
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
        )
    ).parsed
