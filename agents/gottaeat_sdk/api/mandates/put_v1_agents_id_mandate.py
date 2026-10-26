from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.put_v1_agents_id_mandate_body import PutV1AgentsIdMandateBody
from ...models.put_v1_agents_id_mandate_response_201 import PutV1AgentsIdMandateResponse201
from ...models.put_v1_agents_id_mandate_response_400 import PutV1AgentsIdMandateResponse400
from ...models.put_v1_agents_id_mandate_response_401 import PutV1AgentsIdMandateResponse401
from ...models.put_v1_agents_id_mandate_response_403 import PutV1AgentsIdMandateResponse403
from ...models.put_v1_agents_id_mandate_response_404 import PutV1AgentsIdMandateResponse404
from typing import cast


def _get_kwargs(
    id: str,
    *,
    body: PutV1AgentsIdMandateBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/v1/agents/{id}/mandate".format(
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
    PutV1AgentsIdMandateResponse201
    | PutV1AgentsIdMandateResponse400
    | PutV1AgentsIdMandateResponse401
    | PutV1AgentsIdMandateResponse403
    | PutV1AgentsIdMandateResponse404
    | None
):
    if response.status_code == 201:
        response_201 = PutV1AgentsIdMandateResponse201.from_dict(response.json())

        return response_201

    if response.status_code == 400:
        response_400 = PutV1AgentsIdMandateResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PutV1AgentsIdMandateResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PutV1AgentsIdMandateResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = PutV1AgentsIdMandateResponse404.from_dict(response.json())

        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PutV1AgentsIdMandateResponse201
    | PutV1AgentsIdMandateResponse400
    | PutV1AgentsIdMandateResponse401
    | PutV1AgentsIdMandateResponse403
    | PutV1AgentsIdMandateResponse404
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
    body: PutV1AgentsIdMandateBody,
) -> Response[
    PutV1AgentsIdMandateResponse201
    | PutV1AgentsIdMandateResponse400
    | PutV1AgentsIdMandateResponse401
    | PutV1AgentsIdMandateResponse403
    | PutV1AgentsIdMandateResponse404
]:
    """Add a new, unconfirmed mandate version for an agent

     The new version takes effect only after it is confirmed.

    Args:
        id (str):
        body (PutV1AgentsIdMandateBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PutV1AgentsIdMandateResponse201 | PutV1AgentsIdMandateResponse400 | PutV1AgentsIdMandateResponse401 | PutV1AgentsIdMandateResponse403 | PutV1AgentsIdMandateResponse404]
    """

    kwargs = _get_kwargs(
        id=id,
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    id: str,
    *,
    client: AuthenticatedClient,
    body: PutV1AgentsIdMandateBody,
) -> (
    PutV1AgentsIdMandateResponse201
    | PutV1AgentsIdMandateResponse400
    | PutV1AgentsIdMandateResponse401
    | PutV1AgentsIdMandateResponse403
    | PutV1AgentsIdMandateResponse404
    | None
):
    """Add a new, unconfirmed mandate version for an agent

     The new version takes effect only after it is confirmed.

    Args:
        id (str):
        body (PutV1AgentsIdMandateBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PutV1AgentsIdMandateResponse201 | PutV1AgentsIdMandateResponse400 | PutV1AgentsIdMandateResponse401 | PutV1AgentsIdMandateResponse403 | PutV1AgentsIdMandateResponse404
    """

    return sync_detailed(
        id=id,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient,
    body: PutV1AgentsIdMandateBody,
) -> Response[
    PutV1AgentsIdMandateResponse201
    | PutV1AgentsIdMandateResponse400
    | PutV1AgentsIdMandateResponse401
    | PutV1AgentsIdMandateResponse403
    | PutV1AgentsIdMandateResponse404
]:
    """Add a new, unconfirmed mandate version for an agent

     The new version takes effect only after it is confirmed.

    Args:
        id (str):
        body (PutV1AgentsIdMandateBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PutV1AgentsIdMandateResponse201 | PutV1AgentsIdMandateResponse400 | PutV1AgentsIdMandateResponse401 | PutV1AgentsIdMandateResponse403 | PutV1AgentsIdMandateResponse404]
    """

    kwargs = _get_kwargs(
        id=id,
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient,
    body: PutV1AgentsIdMandateBody,
) -> (
    PutV1AgentsIdMandateResponse201
    | PutV1AgentsIdMandateResponse400
    | PutV1AgentsIdMandateResponse401
    | PutV1AgentsIdMandateResponse403
    | PutV1AgentsIdMandateResponse404
    | None
):
    """Add a new, unconfirmed mandate version for an agent

     The new version takes effect only after it is confirmed.

    Args:
        id (str):
        body (PutV1AgentsIdMandateBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PutV1AgentsIdMandateResponse201 | PutV1AgentsIdMandateResponse400 | PutV1AgentsIdMandateResponse401 | PutV1AgentsIdMandateResponse403 | PutV1AgentsIdMandateResponse404
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
            body=body,
        )
    ).parsed
