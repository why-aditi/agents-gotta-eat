from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.get_v1_admin_journals_kind import GetV1AdminJournalsKind
from ...models.get_v1_admin_journals_response_200 import GetV1AdminJournalsResponse200
from ...models.get_v1_admin_journals_response_400 import GetV1AdminJournalsResponse400
from ...models.get_v1_admin_journals_response_401 import GetV1AdminJournalsResponse401
from ...models.get_v1_admin_journals_response_403 import GetV1AdminJournalsResponse403
from ...types import UNSET, Unset
from typing import cast


def _get_kwargs(
    *,
    cursor: str | Unset = UNSET,
    limit: int | Unset = UNSET,
    kind: GetV1AdminJournalsKind | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["cursor"] = cursor

    params["limit"] = limit

    json_kind: str | Unset = UNSET
    if not isinstance(kind, Unset):
        json_kind = kind.value

    params["kind"] = json_kind

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/admin/journals",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    GetV1AdminJournalsResponse200
    | GetV1AdminJournalsResponse400
    | GetV1AdminJournalsResponse401
    | GetV1AdminJournalsResponse403
    | None
):
    if response.status_code == 200:
        response_200 = GetV1AdminJournalsResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = GetV1AdminJournalsResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = GetV1AdminJournalsResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = GetV1AdminJournalsResponse403.from_dict(response.json())

        return response_403

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    GetV1AdminJournalsResponse200
    | GetV1AdminJournalsResponse400
    | GetV1AdminJournalsResponse401
    | GetV1AdminJournalsResponse403
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
    cursor: str | Unset = UNSET,
    limit: int | Unset = UNSET,
    kind: GetV1AdminJournalsKind | Unset = UNSET,
) -> Response[
    GetV1AdminJournalsResponse200
    | GetV1AdminJournalsResponse400
    | GetV1AdminJournalsResponse401
    | GetV1AdminJournalsResponse403
]:
    """List journals, newest first

     Admins only. Cursor-paginated by (created_at, id); pass `nextCursor` back as `cursor`. `limit`
    defaults to 100, max 200. `totalCents` is the sum of the journal's debits.

    Args:
        cursor (str | Unset):
        limit (int | Unset):
        kind (GetV1AdminJournalsKind | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1AdminJournalsResponse200 | GetV1AdminJournalsResponse400 | GetV1AdminJournalsResponse401 | GetV1AdminJournalsResponse403]
    """

    kwargs = _get_kwargs(
        cursor=cursor,
        limit=limit,
        kind=kind,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
    cursor: str | Unset = UNSET,
    limit: int | Unset = UNSET,
    kind: GetV1AdminJournalsKind | Unset = UNSET,
) -> (
    GetV1AdminJournalsResponse200
    | GetV1AdminJournalsResponse400
    | GetV1AdminJournalsResponse401
    | GetV1AdminJournalsResponse403
    | None
):
    """List journals, newest first

     Admins only. Cursor-paginated by (created_at, id); pass `nextCursor` back as `cursor`. `limit`
    defaults to 100, max 200. `totalCents` is the sum of the journal's debits.

    Args:
        cursor (str | Unset):
        limit (int | Unset):
        kind (GetV1AdminJournalsKind | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1AdminJournalsResponse200 | GetV1AdminJournalsResponse400 | GetV1AdminJournalsResponse401 | GetV1AdminJournalsResponse403
    """

    return sync_detailed(
        client=client,
        cursor=cursor,
        limit=limit,
        kind=kind,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    cursor: str | Unset = UNSET,
    limit: int | Unset = UNSET,
    kind: GetV1AdminJournalsKind | Unset = UNSET,
) -> Response[
    GetV1AdminJournalsResponse200
    | GetV1AdminJournalsResponse400
    | GetV1AdminJournalsResponse401
    | GetV1AdminJournalsResponse403
]:
    """List journals, newest first

     Admins only. Cursor-paginated by (created_at, id); pass `nextCursor` back as `cursor`. `limit`
    defaults to 100, max 200. `totalCents` is the sum of the journal's debits.

    Args:
        cursor (str | Unset):
        limit (int | Unset):
        kind (GetV1AdminJournalsKind | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1AdminJournalsResponse200 | GetV1AdminJournalsResponse400 | GetV1AdminJournalsResponse401 | GetV1AdminJournalsResponse403]
    """

    kwargs = _get_kwargs(
        cursor=cursor,
        limit=limit,
        kind=kind,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    cursor: str | Unset = UNSET,
    limit: int | Unset = UNSET,
    kind: GetV1AdminJournalsKind | Unset = UNSET,
) -> (
    GetV1AdminJournalsResponse200
    | GetV1AdminJournalsResponse400
    | GetV1AdminJournalsResponse401
    | GetV1AdminJournalsResponse403
    | None
):
    """List journals, newest first

     Admins only. Cursor-paginated by (created_at, id); pass `nextCursor` back as `cursor`. `limit`
    defaults to 100, max 200. `totalCents` is the sum of the journal's debits.

    Args:
        cursor (str | Unset):
        limit (int | Unset):
        kind (GetV1AdminJournalsKind | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1AdminJournalsResponse200 | GetV1AdminJournalsResponse400 | GetV1AdminJournalsResponse401 | GetV1AdminJournalsResponse403
    """

    return (
        await asyncio_detailed(
            client=client,
            cursor=cursor,
            limit=limit,
            kind=kind,
        )
    ).parsed
