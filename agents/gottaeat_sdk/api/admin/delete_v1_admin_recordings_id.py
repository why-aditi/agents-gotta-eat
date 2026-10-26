from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.delete_v1_admin_recordings_id_response_400 import DeleteV1AdminRecordingsIdResponse400
from ...models.delete_v1_admin_recordings_id_response_401 import DeleteV1AdminRecordingsIdResponse401
from ...models.delete_v1_admin_recordings_id_response_403 import DeleteV1AdminRecordingsIdResponse403
from ...models.delete_v1_admin_recordings_id_response_404 import DeleteV1AdminRecordingsIdResponse404
from typing import cast


def _get_kwargs(
    id: str,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "delete",
        "url": "/v1/admin/recordings/{id}".format(
            id=quote(str(id), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    Any
    | DeleteV1AdminRecordingsIdResponse400
    | DeleteV1AdminRecordingsIdResponse401
    | DeleteV1AdminRecordingsIdResponse403
    | DeleteV1AdminRecordingsIdResponse404
    | None
):
    if response.status_code == 204:
        response_204 = cast(Any, None)
        return response_204

    if response.status_code == 400:
        response_400 = DeleteV1AdminRecordingsIdResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = DeleteV1AdminRecordingsIdResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = DeleteV1AdminRecordingsIdResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = DeleteV1AdminRecordingsIdResponse404.from_dict(response.json())

        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    Any
    | DeleteV1AdminRecordingsIdResponse400
    | DeleteV1AdminRecordingsIdResponse401
    | DeleteV1AdminRecordingsIdResponse403
    | DeleteV1AdminRecordingsIdResponse404
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
    Any
    | DeleteV1AdminRecordingsIdResponse400
    | DeleteV1AdminRecordingsIdResponse401
    | DeleteV1AdminRecordingsIdResponse403
    | DeleteV1AdminRecordingsIdResponse404
]:
    """Delete a recording and its events

     Admins only.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | DeleteV1AdminRecordingsIdResponse400 | DeleteV1AdminRecordingsIdResponse401 | DeleteV1AdminRecordingsIdResponse403 | DeleteV1AdminRecordingsIdResponse404]
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
    Any
    | DeleteV1AdminRecordingsIdResponse400
    | DeleteV1AdminRecordingsIdResponse401
    | DeleteV1AdminRecordingsIdResponse403
    | DeleteV1AdminRecordingsIdResponse404
    | None
):
    """Delete a recording and its events

     Admins only.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | DeleteV1AdminRecordingsIdResponse400 | DeleteV1AdminRecordingsIdResponse401 | DeleteV1AdminRecordingsIdResponse403 | DeleteV1AdminRecordingsIdResponse404
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
    Any
    | DeleteV1AdminRecordingsIdResponse400
    | DeleteV1AdminRecordingsIdResponse401
    | DeleteV1AdminRecordingsIdResponse403
    | DeleteV1AdminRecordingsIdResponse404
]:
    """Delete a recording and its events

     Admins only.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | DeleteV1AdminRecordingsIdResponse400 | DeleteV1AdminRecordingsIdResponse401 | DeleteV1AdminRecordingsIdResponse403 | DeleteV1AdminRecordingsIdResponse404]
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
    Any
    | DeleteV1AdminRecordingsIdResponse400
    | DeleteV1AdminRecordingsIdResponse401
    | DeleteV1AdminRecordingsIdResponse403
    | DeleteV1AdminRecordingsIdResponse404
    | None
):
    """Delete a recording and its events

     Admins only.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | DeleteV1AdminRecordingsIdResponse400 | DeleteV1AdminRecordingsIdResponse401 | DeleteV1AdminRecordingsIdResponse403 | DeleteV1AdminRecordingsIdResponse404
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
        )
    ).parsed
