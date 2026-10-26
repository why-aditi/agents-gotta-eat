from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.get_v1_approvals_response_200 import GetV1ApprovalsResponse200
from ...models.get_v1_approvals_response_400 import GetV1ApprovalsResponse400
from ...models.get_v1_approvals_response_401 import GetV1ApprovalsResponse401
from ...models.get_v1_approvals_response_403 import GetV1ApprovalsResponse403
from ...models.get_v1_approvals_status import GetV1ApprovalsStatus
from ...types import UNSET, Unset
from typing import cast


def _get_kwargs(
    *,
    status: GetV1ApprovalsStatus | Unset = GetV1ApprovalsStatus.PENDING,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    json_status: str | Unset = UNSET
    if not isinstance(status, Unset):
        json_status = status.value

    params["status"] = json_status

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/approvals",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    GetV1ApprovalsResponse200 | GetV1ApprovalsResponse400 | GetV1ApprovalsResponse401 | GetV1ApprovalsResponse403 | None
):
    if response.status_code == 200:
        response_200 = GetV1ApprovalsResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = GetV1ApprovalsResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = GetV1ApprovalsResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = GetV1ApprovalsResponse403.from_dict(response.json())

        return response_403

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    GetV1ApprovalsResponse200 | GetV1ApprovalsResponse400 | GetV1ApprovalsResponse401 | GetV1ApprovalsResponse403
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
    status: GetV1ApprovalsStatus | Unset = GetV1ApprovalsStatus.PENDING,
) -> Response[
    GetV1ApprovalsResponse200 | GetV1ApprovalsResponse400 | GetV1ApprovalsResponse401 | GetV1ApprovalsResponse403
]:
    """Spend requests waiting for the owner, oldest first

    Args:
        status (GetV1ApprovalsStatus | Unset):  Default: GetV1ApprovalsStatus.PENDING.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1ApprovalsResponse200 | GetV1ApprovalsResponse400 | GetV1ApprovalsResponse401 | GetV1ApprovalsResponse403]
    """

    kwargs = _get_kwargs(
        status=status,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
    status: GetV1ApprovalsStatus | Unset = GetV1ApprovalsStatus.PENDING,
) -> (
    GetV1ApprovalsResponse200 | GetV1ApprovalsResponse400 | GetV1ApprovalsResponse401 | GetV1ApprovalsResponse403 | None
):
    """Spend requests waiting for the owner, oldest first

    Args:
        status (GetV1ApprovalsStatus | Unset):  Default: GetV1ApprovalsStatus.PENDING.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1ApprovalsResponse200 | GetV1ApprovalsResponse400 | GetV1ApprovalsResponse401 | GetV1ApprovalsResponse403
    """

    return sync_detailed(
        client=client,
        status=status,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    status: GetV1ApprovalsStatus | Unset = GetV1ApprovalsStatus.PENDING,
) -> Response[
    GetV1ApprovalsResponse200 | GetV1ApprovalsResponse400 | GetV1ApprovalsResponse401 | GetV1ApprovalsResponse403
]:
    """Spend requests waiting for the owner, oldest first

    Args:
        status (GetV1ApprovalsStatus | Unset):  Default: GetV1ApprovalsStatus.PENDING.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1ApprovalsResponse200 | GetV1ApprovalsResponse400 | GetV1ApprovalsResponse401 | GetV1ApprovalsResponse403]
    """

    kwargs = _get_kwargs(
        status=status,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    status: GetV1ApprovalsStatus | Unset = GetV1ApprovalsStatus.PENDING,
) -> (
    GetV1ApprovalsResponse200 | GetV1ApprovalsResponse400 | GetV1ApprovalsResponse401 | GetV1ApprovalsResponse403 | None
):
    """Spend requests waiting for the owner, oldest first

    Args:
        status (GetV1ApprovalsStatus | Unset):  Default: GetV1ApprovalsStatus.PENDING.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1ApprovalsResponse200 | GetV1ApprovalsResponse400 | GetV1ApprovalsResponse401 | GetV1ApprovalsResponse403
    """

    return (
        await asyncio_detailed(
            client=client,
            status=status,
        )
    ).parsed
