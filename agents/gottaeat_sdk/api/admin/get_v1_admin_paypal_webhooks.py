from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.get_v1_admin_paypal_webhooks_response_200 import GetV1AdminPaypalWebhooksResponse200
from ...models.get_v1_admin_paypal_webhooks_response_400 import GetV1AdminPaypalWebhooksResponse400
from ...models.get_v1_admin_paypal_webhooks_response_401 import GetV1AdminPaypalWebhooksResponse401
from ...models.get_v1_admin_paypal_webhooks_response_403 import GetV1AdminPaypalWebhooksResponse403
from ...models.get_v1_admin_paypal_webhooks_response_503 import GetV1AdminPaypalWebhooksResponse503
from ...types import UNSET, Unset
from typing import cast


def _get_kwargs(
    *,
    cursor: str | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["cursor"] = cursor

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/admin/paypal/webhooks",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    GetV1AdminPaypalWebhooksResponse200
    | GetV1AdminPaypalWebhooksResponse400
    | GetV1AdminPaypalWebhooksResponse401
    | GetV1AdminPaypalWebhooksResponse403
    | GetV1AdminPaypalWebhooksResponse503
    | None
):
    if response.status_code == 200:
        response_200 = GetV1AdminPaypalWebhooksResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = GetV1AdminPaypalWebhooksResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = GetV1AdminPaypalWebhooksResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = GetV1AdminPaypalWebhooksResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 503:
        response_503 = GetV1AdminPaypalWebhooksResponse503.from_dict(response.json())

        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    GetV1AdminPaypalWebhooksResponse200
    | GetV1AdminPaypalWebhooksResponse400
    | GetV1AdminPaypalWebhooksResponse401
    | GetV1AdminPaypalWebhooksResponse403
    | GetV1AdminPaypalWebhooksResponse503
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
) -> Response[
    GetV1AdminPaypalWebhooksResponse200
    | GetV1AdminPaypalWebhooksResponse400
    | GetV1AdminPaypalWebhooksResponse401
    | GetV1AdminPaypalWebhooksResponse403
    | GetV1AdminPaypalWebhooksResponse503
]:
    """Stored PayPal webhook events, newest first

     Admins only. 100 per page; pass `nextCursor` back as `cursor`. Never the payload: id, PayPal event
    id, type, when it was received and processed, and the last processing error.

    Args:
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1AdminPaypalWebhooksResponse200 | GetV1AdminPaypalWebhooksResponse400 | GetV1AdminPaypalWebhooksResponse401 | GetV1AdminPaypalWebhooksResponse403 | GetV1AdminPaypalWebhooksResponse503]
    """

    kwargs = _get_kwargs(
        cursor=cursor,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
    cursor: str | Unset = UNSET,
) -> (
    GetV1AdminPaypalWebhooksResponse200
    | GetV1AdminPaypalWebhooksResponse400
    | GetV1AdminPaypalWebhooksResponse401
    | GetV1AdminPaypalWebhooksResponse403
    | GetV1AdminPaypalWebhooksResponse503
    | None
):
    """Stored PayPal webhook events, newest first

     Admins only. 100 per page; pass `nextCursor` back as `cursor`. Never the payload: id, PayPal event
    id, type, when it was received and processed, and the last processing error.

    Args:
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1AdminPaypalWebhooksResponse200 | GetV1AdminPaypalWebhooksResponse400 | GetV1AdminPaypalWebhooksResponse401 | GetV1AdminPaypalWebhooksResponse403 | GetV1AdminPaypalWebhooksResponse503
    """

    return sync_detailed(
        client=client,
        cursor=cursor,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    cursor: str | Unset = UNSET,
) -> Response[
    GetV1AdminPaypalWebhooksResponse200
    | GetV1AdminPaypalWebhooksResponse400
    | GetV1AdminPaypalWebhooksResponse401
    | GetV1AdminPaypalWebhooksResponse403
    | GetV1AdminPaypalWebhooksResponse503
]:
    """Stored PayPal webhook events, newest first

     Admins only. 100 per page; pass `nextCursor` back as `cursor`. Never the payload: id, PayPal event
    id, type, when it was received and processed, and the last processing error.

    Args:
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1AdminPaypalWebhooksResponse200 | GetV1AdminPaypalWebhooksResponse400 | GetV1AdminPaypalWebhooksResponse401 | GetV1AdminPaypalWebhooksResponse403 | GetV1AdminPaypalWebhooksResponse503]
    """

    kwargs = _get_kwargs(
        cursor=cursor,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    cursor: str | Unset = UNSET,
) -> (
    GetV1AdminPaypalWebhooksResponse200
    | GetV1AdminPaypalWebhooksResponse400
    | GetV1AdminPaypalWebhooksResponse401
    | GetV1AdminPaypalWebhooksResponse403
    | GetV1AdminPaypalWebhooksResponse503
    | None
):
    """Stored PayPal webhook events, newest first

     Admins only. 100 per page; pass `nextCursor` back as `cursor`. Never the payload: id, PayPal event
    id, type, when it was received and processed, and the last processing error.

    Args:
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1AdminPaypalWebhooksResponse200 | GetV1AdminPaypalWebhooksResponse400 | GetV1AdminPaypalWebhooksResponse401 | GetV1AdminPaypalWebhooksResponse403 | GetV1AdminPaypalWebhooksResponse503
    """

    return (
        await asyncio_detailed(
            client=client,
            cursor=cursor,
        )
    ).parsed
