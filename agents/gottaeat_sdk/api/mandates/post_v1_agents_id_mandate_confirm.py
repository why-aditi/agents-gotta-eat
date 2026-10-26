from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_agents_id_mandate_confirm_body import PostV1AgentsIdMandateConfirmBody
from ...models.post_v1_agents_id_mandate_confirm_response_200 import PostV1AgentsIdMandateConfirmResponse200
from ...models.post_v1_agents_id_mandate_confirm_response_400 import PostV1AgentsIdMandateConfirmResponse400
from ...models.post_v1_agents_id_mandate_confirm_response_401 import PostV1AgentsIdMandateConfirmResponse401
from ...models.post_v1_agents_id_mandate_confirm_response_403 import PostV1AgentsIdMandateConfirmResponse403
from ...models.post_v1_agents_id_mandate_confirm_response_404 import PostV1AgentsIdMandateConfirmResponse404
from typing import cast


def _get_kwargs(
    id: str,
    *,
    body: PostV1AgentsIdMandateConfirmBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/agents/{id}/mandate/confirm".format(
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
    PostV1AgentsIdMandateConfirmResponse200
    | PostV1AgentsIdMandateConfirmResponse400
    | PostV1AgentsIdMandateConfirmResponse401
    | PostV1AgentsIdMandateConfirmResponse403
    | PostV1AgentsIdMandateConfirmResponse404
    | None
):
    if response.status_code == 200:
        response_200 = PostV1AgentsIdMandateConfirmResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = PostV1AgentsIdMandateConfirmResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1AgentsIdMandateConfirmResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1AgentsIdMandateConfirmResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = PostV1AgentsIdMandateConfirmResponse404.from_dict(response.json())

        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1AgentsIdMandateConfirmResponse200
    | PostV1AgentsIdMandateConfirmResponse400
    | PostV1AgentsIdMandateConfirmResponse401
    | PostV1AgentsIdMandateConfirmResponse403
    | PostV1AgentsIdMandateConfirmResponse404
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
    body: PostV1AgentsIdMandateConfirmBody,
) -> Response[
    PostV1AgentsIdMandateConfirmResponse200
    | PostV1AgentsIdMandateConfirmResponse400
    | PostV1AgentsIdMandateConfirmResponse401
    | PostV1AgentsIdMandateConfirmResponse403
    | PostV1AgentsIdMandateConfirmResponse404
]:
    """Confirm a mandate version

     The highest confirmed version is the active mandate.

    Args:
        id (str):
        body (PostV1AgentsIdMandateConfirmBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AgentsIdMandateConfirmResponse200 | PostV1AgentsIdMandateConfirmResponse400 | PostV1AgentsIdMandateConfirmResponse401 | PostV1AgentsIdMandateConfirmResponse403 | PostV1AgentsIdMandateConfirmResponse404]
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
    body: PostV1AgentsIdMandateConfirmBody,
) -> (
    PostV1AgentsIdMandateConfirmResponse200
    | PostV1AgentsIdMandateConfirmResponse400
    | PostV1AgentsIdMandateConfirmResponse401
    | PostV1AgentsIdMandateConfirmResponse403
    | PostV1AgentsIdMandateConfirmResponse404
    | None
):
    """Confirm a mandate version

     The highest confirmed version is the active mandate.

    Args:
        id (str):
        body (PostV1AgentsIdMandateConfirmBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AgentsIdMandateConfirmResponse200 | PostV1AgentsIdMandateConfirmResponse400 | PostV1AgentsIdMandateConfirmResponse401 | PostV1AgentsIdMandateConfirmResponse403 | PostV1AgentsIdMandateConfirmResponse404
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
    body: PostV1AgentsIdMandateConfirmBody,
) -> Response[
    PostV1AgentsIdMandateConfirmResponse200
    | PostV1AgentsIdMandateConfirmResponse400
    | PostV1AgentsIdMandateConfirmResponse401
    | PostV1AgentsIdMandateConfirmResponse403
    | PostV1AgentsIdMandateConfirmResponse404
]:
    """Confirm a mandate version

     The highest confirmed version is the active mandate.

    Args:
        id (str):
        body (PostV1AgentsIdMandateConfirmBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AgentsIdMandateConfirmResponse200 | PostV1AgentsIdMandateConfirmResponse400 | PostV1AgentsIdMandateConfirmResponse401 | PostV1AgentsIdMandateConfirmResponse403 | PostV1AgentsIdMandateConfirmResponse404]
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
    body: PostV1AgentsIdMandateConfirmBody,
) -> (
    PostV1AgentsIdMandateConfirmResponse200
    | PostV1AgentsIdMandateConfirmResponse400
    | PostV1AgentsIdMandateConfirmResponse401
    | PostV1AgentsIdMandateConfirmResponse403
    | PostV1AgentsIdMandateConfirmResponse404
    | None
):
    """Confirm a mandate version

     The highest confirmed version is the active mandate.

    Args:
        id (str):
        body (PostV1AgentsIdMandateConfirmBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AgentsIdMandateConfirmResponse200 | PostV1AgentsIdMandateConfirmResponse400 | PostV1AgentsIdMandateConfirmResponse401 | PostV1AgentsIdMandateConfirmResponse403 | PostV1AgentsIdMandateConfirmResponse404
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
            body=body,
        )
    ).parsed
