from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.delete_v1_agents_id_key_response_400 import DeleteV1AgentsIdKeyResponse400
from ...models.delete_v1_agents_id_key_response_401 import DeleteV1AgentsIdKeyResponse401
from ...models.delete_v1_agents_id_key_response_403 import DeleteV1AgentsIdKeyResponse403
from ...models.delete_v1_agents_id_key_response_404 import DeleteV1AgentsIdKeyResponse404
from typing import cast


def _get_kwargs(
    id: str,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "delete",
        "url": "/v1/agents/{id}/key".format(
            id=quote(str(id), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    Any
    | DeleteV1AgentsIdKeyResponse400
    | DeleteV1AgentsIdKeyResponse401
    | DeleteV1AgentsIdKeyResponse403
    | DeleteV1AgentsIdKeyResponse404
    | None
):
    if response.status_code == 204:
        response_204 = cast(Any, None)
        return response_204

    if response.status_code == 400:
        response_400 = DeleteV1AgentsIdKeyResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = DeleteV1AgentsIdKeyResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = DeleteV1AgentsIdKeyResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = DeleteV1AgentsIdKeyResponse404.from_dict(response.json())

        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    Any
    | DeleteV1AgentsIdKeyResponse400
    | DeleteV1AgentsIdKeyResponse401
    | DeleteV1AgentsIdKeyResponse403
    | DeleteV1AgentsIdKeyResponse404
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
    | DeleteV1AgentsIdKeyResponse400
    | DeleteV1AgentsIdKeyResponse401
    | DeleteV1AgentsIdKeyResponse403
    | DeleteV1AgentsIdKeyResponse404
]:
    """Revoke an agent's API key

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | DeleteV1AgentsIdKeyResponse400 | DeleteV1AgentsIdKeyResponse401 | DeleteV1AgentsIdKeyResponse403 | DeleteV1AgentsIdKeyResponse404]
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
    | DeleteV1AgentsIdKeyResponse400
    | DeleteV1AgentsIdKeyResponse401
    | DeleteV1AgentsIdKeyResponse403
    | DeleteV1AgentsIdKeyResponse404
    | None
):
    """Revoke an agent's API key

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | DeleteV1AgentsIdKeyResponse400 | DeleteV1AgentsIdKeyResponse401 | DeleteV1AgentsIdKeyResponse403 | DeleteV1AgentsIdKeyResponse404
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
    | DeleteV1AgentsIdKeyResponse400
    | DeleteV1AgentsIdKeyResponse401
    | DeleteV1AgentsIdKeyResponse403
    | DeleteV1AgentsIdKeyResponse404
]:
    """Revoke an agent's API key

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | DeleteV1AgentsIdKeyResponse400 | DeleteV1AgentsIdKeyResponse401 | DeleteV1AgentsIdKeyResponse403 | DeleteV1AgentsIdKeyResponse404]
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
    | DeleteV1AgentsIdKeyResponse400
    | DeleteV1AgentsIdKeyResponse401
    | DeleteV1AgentsIdKeyResponse403
    | DeleteV1AgentsIdKeyResponse404
    | None
):
    """Revoke an agent's API key

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | DeleteV1AgentsIdKeyResponse400 | DeleteV1AgentsIdKeyResponse401 | DeleteV1AgentsIdKeyResponse403 | DeleteV1AgentsIdKeyResponse404
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
        )
    ).parsed
