from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_admin_reconcile_paypal_body import PostV1AdminReconcilePaypalBody
from ...models.post_v1_admin_reconcile_paypal_fresh import PostV1AdminReconcilePaypalFresh
from ...models.post_v1_admin_reconcile_paypal_response_200 import PostV1AdminReconcilePaypalResponse200
from ...models.post_v1_admin_reconcile_paypal_response_400 import PostV1AdminReconcilePaypalResponse400
from ...models.post_v1_admin_reconcile_paypal_response_401 import PostV1AdminReconcilePaypalResponse401
from ...models.post_v1_admin_reconcile_paypal_response_403 import PostV1AdminReconcilePaypalResponse403
from ...models.post_v1_admin_reconcile_paypal_response_502 import PostV1AdminReconcilePaypalResponse502
from ...models.post_v1_admin_reconcile_paypal_response_503 import PostV1AdminReconcilePaypalResponse503
from ...types import UNSET, Unset
from typing import cast


def _get_kwargs(
    *,
    body: PostV1AdminReconcilePaypalBody,
    fresh: PostV1AdminReconcilePaypalFresh | Unset = UNSET,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    params: dict[str, Any] = {}

    json_fresh: str | Unset = UNSET
    if not isinstance(fresh, Unset):
        json_fresh = fresh.value

    params["fresh"] = json_fresh

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/admin/reconcile/paypal",
        "params": params,
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    PostV1AdminReconcilePaypalResponse200
    | PostV1AdminReconcilePaypalResponse400
    | PostV1AdminReconcilePaypalResponse401
    | PostV1AdminReconcilePaypalResponse403
    | PostV1AdminReconcilePaypalResponse502
    | PostV1AdminReconcilePaypalResponse503
    | None
):
    if response.status_code == 200:
        response_200 = PostV1AdminReconcilePaypalResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = PostV1AdminReconcilePaypalResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1AdminReconcilePaypalResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1AdminReconcilePaypalResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 502:
        response_502 = PostV1AdminReconcilePaypalResponse502.from_dict(response.json())

        return response_502

    if response.status_code == 503:
        response_503 = PostV1AdminReconcilePaypalResponse503.from_dict(response.json())

        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1AdminReconcilePaypalResponse200
    | PostV1AdminReconcilePaypalResponse400
    | PostV1AdminReconcilePaypalResponse401
    | PostV1AdminReconcilePaypalResponse403
    | PostV1AdminReconcilePaypalResponse502
    | PostV1AdminReconcilePaypalResponse503
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
    body: PostV1AdminReconcilePaypalBody,
    fresh: PostV1AdminReconcilePaypalFresh | Unset = UNSET,
) -> Response[
    PostV1AdminReconcilePaypalResponse200
    | PostV1AdminReconcilePaypalResponse400
    | PostV1AdminReconcilePaypalResponse401
    | PostV1AdminReconcilePaypalResponse403
    | PostV1AdminReconcilePaypalResponse502
    | PostV1AdminReconcilePaypalResponse503
]:
    """Reconcile the ledger against PayPal

     Admins only. Matches every journal touching paypal:clearing in the last `days` (default 7, max 31)
    with PayPal's transaction search (Agent Toolkit) by PayPal id and amount. Classes: matched,
    missing_in_paypal, missing_in_ledger, amount_mismatch, pending (ledger side under 3 hours old).
    Cached 15 minutes; `?fresh=true` runs it again. Moves no money.

    Args:
        fresh (PostV1AdminReconcilePaypalFresh | Unset):
        body (PostV1AdminReconcilePaypalBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AdminReconcilePaypalResponse200 | PostV1AdminReconcilePaypalResponse400 | PostV1AdminReconcilePaypalResponse401 | PostV1AdminReconcilePaypalResponse403 | PostV1AdminReconcilePaypalResponse502 | PostV1AdminReconcilePaypalResponse503]
    """

    kwargs = _get_kwargs(
        body=body,
        fresh=fresh,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
    body: PostV1AdminReconcilePaypalBody,
    fresh: PostV1AdminReconcilePaypalFresh | Unset = UNSET,
) -> (
    PostV1AdminReconcilePaypalResponse200
    | PostV1AdminReconcilePaypalResponse400
    | PostV1AdminReconcilePaypalResponse401
    | PostV1AdminReconcilePaypalResponse403
    | PostV1AdminReconcilePaypalResponse502
    | PostV1AdminReconcilePaypalResponse503
    | None
):
    """Reconcile the ledger against PayPal

     Admins only. Matches every journal touching paypal:clearing in the last `days` (default 7, max 31)
    with PayPal's transaction search (Agent Toolkit) by PayPal id and amount. Classes: matched,
    missing_in_paypal, missing_in_ledger, amount_mismatch, pending (ledger side under 3 hours old).
    Cached 15 minutes; `?fresh=true` runs it again. Moves no money.

    Args:
        fresh (PostV1AdminReconcilePaypalFresh | Unset):
        body (PostV1AdminReconcilePaypalBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AdminReconcilePaypalResponse200 | PostV1AdminReconcilePaypalResponse400 | PostV1AdminReconcilePaypalResponse401 | PostV1AdminReconcilePaypalResponse403 | PostV1AdminReconcilePaypalResponse502 | PostV1AdminReconcilePaypalResponse503
    """

    return sync_detailed(
        client=client,
        body=body,
        fresh=fresh,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: PostV1AdminReconcilePaypalBody,
    fresh: PostV1AdminReconcilePaypalFresh | Unset = UNSET,
) -> Response[
    PostV1AdminReconcilePaypalResponse200
    | PostV1AdminReconcilePaypalResponse400
    | PostV1AdminReconcilePaypalResponse401
    | PostV1AdminReconcilePaypalResponse403
    | PostV1AdminReconcilePaypalResponse502
    | PostV1AdminReconcilePaypalResponse503
]:
    """Reconcile the ledger against PayPal

     Admins only. Matches every journal touching paypal:clearing in the last `days` (default 7, max 31)
    with PayPal's transaction search (Agent Toolkit) by PayPal id and amount. Classes: matched,
    missing_in_paypal, missing_in_ledger, amount_mismatch, pending (ledger side under 3 hours old).
    Cached 15 minutes; `?fresh=true` runs it again. Moves no money.

    Args:
        fresh (PostV1AdminReconcilePaypalFresh | Unset):
        body (PostV1AdminReconcilePaypalBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AdminReconcilePaypalResponse200 | PostV1AdminReconcilePaypalResponse400 | PostV1AdminReconcilePaypalResponse401 | PostV1AdminReconcilePaypalResponse403 | PostV1AdminReconcilePaypalResponse502 | PostV1AdminReconcilePaypalResponse503]
    """

    kwargs = _get_kwargs(
        body=body,
        fresh=fresh,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: PostV1AdminReconcilePaypalBody,
    fresh: PostV1AdminReconcilePaypalFresh | Unset = UNSET,
) -> (
    PostV1AdminReconcilePaypalResponse200
    | PostV1AdminReconcilePaypalResponse400
    | PostV1AdminReconcilePaypalResponse401
    | PostV1AdminReconcilePaypalResponse403
    | PostV1AdminReconcilePaypalResponse502
    | PostV1AdminReconcilePaypalResponse503
    | None
):
    """Reconcile the ledger against PayPal

     Admins only. Matches every journal touching paypal:clearing in the last `days` (default 7, max 31)
    with PayPal's transaction search (Agent Toolkit) by PayPal id and amount. Classes: matched,
    missing_in_paypal, missing_in_ledger, amount_mismatch, pending (ledger side under 3 hours old).
    Cached 15 minutes; `?fresh=true` runs it again. Moves no money.

    Args:
        fresh (PostV1AdminReconcilePaypalFresh | Unset):
        body (PostV1AdminReconcilePaypalBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AdminReconcilePaypalResponse200 | PostV1AdminReconcilePaypalResponse400 | PostV1AdminReconcilePaypalResponse401 | PostV1AdminReconcilePaypalResponse403 | PostV1AdminReconcilePaypalResponse502 | PostV1AdminReconcilePaypalResponse503
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
            fresh=fresh,
        )
    ).parsed
