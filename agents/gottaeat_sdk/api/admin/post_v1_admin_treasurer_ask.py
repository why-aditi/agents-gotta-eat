from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_admin_treasurer_ask_body import PostV1AdminTreasurerAskBody
from ...models.post_v1_admin_treasurer_ask_response_200 import PostV1AdminTreasurerAskResponse200
from ...models.post_v1_admin_treasurer_ask_response_400 import PostV1AdminTreasurerAskResponse400
from ...models.post_v1_admin_treasurer_ask_response_401 import PostV1AdminTreasurerAskResponse401
from ...models.post_v1_admin_treasurer_ask_response_403 import PostV1AdminTreasurerAskResponse403
from ...models.post_v1_admin_treasurer_ask_response_429 import PostV1AdminTreasurerAskResponse429
from typing import cast


def _get_kwargs(
    *,
    body: PostV1AdminTreasurerAskBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/admin/treasurer/ask",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    PostV1AdminTreasurerAskResponse200
    | PostV1AdminTreasurerAskResponse400
    | PostV1AdminTreasurerAskResponse401
    | PostV1AdminTreasurerAskResponse403
    | PostV1AdminTreasurerAskResponse429
    | None
):
    if response.status_code == 200:
        response_200 = PostV1AdminTreasurerAskResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = PostV1AdminTreasurerAskResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1AdminTreasurerAskResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1AdminTreasurerAskResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 429:
        response_429 = PostV1AdminTreasurerAskResponse429.from_dict(response.json())

        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1AdminTreasurerAskResponse200
    | PostV1AdminTreasurerAskResponse400
    | PostV1AdminTreasurerAskResponse401
    | PostV1AdminTreasurerAskResponse403
    | PostV1AdminTreasurerAskResponse429
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
    body: PostV1AdminTreasurerAskBody,
) -> Response[
    PostV1AdminTreasurerAskResponse200
    | PostV1AdminTreasurerAskResponse400
    | PostV1AdminTreasurerAskResponse401
    | PostV1AdminTreasurerAskResponse403
    | PostV1AdminTreasurerAskResponse429
]:
    """Ask the Treasurer a money question

     Admins only, 10 per minute. The Treasurer answers from read-only tools over the ledger, payments,
    escrow and PayPal (Agent Toolkit), citing the ids it relied on, with a trace of tool summaries.
    Without the LLM gateway (or when it fails) `fallback` is true and the answer is a fixed report. The
    answer is plain text. Moves no money.

    Args:
        body (PostV1AdminTreasurerAskBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AdminTreasurerAskResponse200 | PostV1AdminTreasurerAskResponse400 | PostV1AdminTreasurerAskResponse401 | PostV1AdminTreasurerAskResponse403 | PostV1AdminTreasurerAskResponse429]
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
    body: PostV1AdminTreasurerAskBody,
) -> (
    PostV1AdminTreasurerAskResponse200
    | PostV1AdminTreasurerAskResponse400
    | PostV1AdminTreasurerAskResponse401
    | PostV1AdminTreasurerAskResponse403
    | PostV1AdminTreasurerAskResponse429
    | None
):
    """Ask the Treasurer a money question

     Admins only, 10 per minute. The Treasurer answers from read-only tools over the ledger, payments,
    escrow and PayPal (Agent Toolkit), citing the ids it relied on, with a trace of tool summaries.
    Without the LLM gateway (or when it fails) `fallback` is true and the answer is a fixed report. The
    answer is plain text. Moves no money.

    Args:
        body (PostV1AdminTreasurerAskBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AdminTreasurerAskResponse200 | PostV1AdminTreasurerAskResponse400 | PostV1AdminTreasurerAskResponse401 | PostV1AdminTreasurerAskResponse403 | PostV1AdminTreasurerAskResponse429
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: PostV1AdminTreasurerAskBody,
) -> Response[
    PostV1AdminTreasurerAskResponse200
    | PostV1AdminTreasurerAskResponse400
    | PostV1AdminTreasurerAskResponse401
    | PostV1AdminTreasurerAskResponse403
    | PostV1AdminTreasurerAskResponse429
]:
    """Ask the Treasurer a money question

     Admins only, 10 per minute. The Treasurer answers from read-only tools over the ledger, payments,
    escrow and PayPal (Agent Toolkit), citing the ids it relied on, with a trace of tool summaries.
    Without the LLM gateway (or when it fails) `fallback` is true and the answer is a fixed report. The
    answer is plain text. Moves no money.

    Args:
        body (PostV1AdminTreasurerAskBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AdminTreasurerAskResponse200 | PostV1AdminTreasurerAskResponse400 | PostV1AdminTreasurerAskResponse401 | PostV1AdminTreasurerAskResponse403 | PostV1AdminTreasurerAskResponse429]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: PostV1AdminTreasurerAskBody,
) -> (
    PostV1AdminTreasurerAskResponse200
    | PostV1AdminTreasurerAskResponse400
    | PostV1AdminTreasurerAskResponse401
    | PostV1AdminTreasurerAskResponse403
    | PostV1AdminTreasurerAskResponse429
    | None
):
    """Ask the Treasurer a money question

     Admins only, 10 per minute. The Treasurer answers from read-only tools over the ledger, payments,
    escrow and PayPal (Agent Toolkit), citing the ids it relied on, with a trace of tool summaries.
    Without the LLM gateway (or when it fails) `fallback` is true and the answer is a fixed report. The
    answer is plain text. Moves no money.

    Args:
        body (PostV1AdminTreasurerAskBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AdminTreasurerAskResponse200 | PostV1AdminTreasurerAskResponse400 | PostV1AdminTreasurerAskResponse401 | PostV1AdminTreasurerAskResponse403 | PostV1AdminTreasurerAskResponse429
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
