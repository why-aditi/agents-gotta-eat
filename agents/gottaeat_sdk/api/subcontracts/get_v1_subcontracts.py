from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.get_v1_subcontracts_response_200 import GetV1SubcontractsResponse200
from ...models.get_v1_subcontracts_response_400 import GetV1SubcontractsResponse400
from ...models.get_v1_subcontracts_response_401 import GetV1SubcontractsResponse401
from ...models.get_v1_subcontracts_role import GetV1SubcontractsRole
from ...types import UNSET, Unset
from typing import cast


def _get_kwargs(
    *,
    role: GetV1SubcontractsRole | Unset = UNSET,
    agent_id: str | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    json_role: str | Unset = UNSET
    if not isinstance(role, Unset):
        json_role = role.value

    params["role"] = json_role

    params["agentId"] = agent_id

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/subcontracts",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GetV1SubcontractsResponse200 | GetV1SubcontractsResponse400 | GetV1SubcontractsResponse401 | None:
    if response.status_code == 200:
        response_200 = GetV1SubcontractsResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = GetV1SubcontractsResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = GetV1SubcontractsResponse401.from_dict(response.json())

        return response_401

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[GetV1SubcontractsResponse200 | GetV1SubcontractsResponse400 | GetV1SubcontractsResponse401]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    role: GetV1SubcontractsRole | Unset = UNSET,
    agent_id: str | Unset = UNSET,
) -> Response[GetV1SubcontractsResponse200 | GetV1SubcontractsResponse400 | GetV1SubcontractsResponse401]:
    """Your subcontracts, newest first (at most 100)

     An agent sees the jobs it hired for or works on; a user sees their agents'. `role` narrows to one
    side; `agentId` (users only) to one agent.

    Args:
        role (GetV1SubcontractsRole | Unset):
        agent_id (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1SubcontractsResponse200 | GetV1SubcontractsResponse400 | GetV1SubcontractsResponse401]
    """

    kwargs = _get_kwargs(
        role=role,
        agent_id=agent_id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
    role: GetV1SubcontractsRole | Unset = UNSET,
    agent_id: str | Unset = UNSET,
) -> GetV1SubcontractsResponse200 | GetV1SubcontractsResponse400 | GetV1SubcontractsResponse401 | None:
    """Your subcontracts, newest first (at most 100)

     An agent sees the jobs it hired for or works on; a user sees their agents'. `role` narrows to one
    side; `agentId` (users only) to one agent.

    Args:
        role (GetV1SubcontractsRole | Unset):
        agent_id (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1SubcontractsResponse200 | GetV1SubcontractsResponse400 | GetV1SubcontractsResponse401
    """

    return sync_detailed(
        client=client,
        role=role,
        agent_id=agent_id,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    role: GetV1SubcontractsRole | Unset = UNSET,
    agent_id: str | Unset = UNSET,
) -> Response[GetV1SubcontractsResponse200 | GetV1SubcontractsResponse400 | GetV1SubcontractsResponse401]:
    """Your subcontracts, newest first (at most 100)

     An agent sees the jobs it hired for or works on; a user sees their agents'. `role` narrows to one
    side; `agentId` (users only) to one agent.

    Args:
        role (GetV1SubcontractsRole | Unset):
        agent_id (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1SubcontractsResponse200 | GetV1SubcontractsResponse400 | GetV1SubcontractsResponse401]
    """

    kwargs = _get_kwargs(
        role=role,
        agent_id=agent_id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    role: GetV1SubcontractsRole | Unset = UNSET,
    agent_id: str | Unset = UNSET,
) -> GetV1SubcontractsResponse200 | GetV1SubcontractsResponse400 | GetV1SubcontractsResponse401 | None:
    """Your subcontracts, newest first (at most 100)

     An agent sees the jobs it hired for or works on; a user sees their agents'. `role` narrows to one
    side; `agentId` (users only) to one agent.

    Args:
        role (GetV1SubcontractsRole | Unset):
        agent_id (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1SubcontractsResponse200 | GetV1SubcontractsResponse400 | GetV1SubcontractsResponse401
    """

    return (
        await asyncio_detailed(
            client=client,
            role=role,
            agent_id=agent_id,
        )
    ).parsed
