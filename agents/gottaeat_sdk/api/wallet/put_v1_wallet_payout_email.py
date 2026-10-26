from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.put_v1_wallet_payout_email_body import PutV1WalletPayoutEmailBody
from ...models.put_v1_wallet_payout_email_response_200 import PutV1WalletPayoutEmailResponse200
from ...models.put_v1_wallet_payout_email_response_400 import PutV1WalletPayoutEmailResponse400
from ...models.put_v1_wallet_payout_email_response_401 import PutV1WalletPayoutEmailResponse401
from ...models.put_v1_wallet_payout_email_response_403 import PutV1WalletPayoutEmailResponse403
from ...models.put_v1_wallet_payout_email_response_409 import PutV1WalletPayoutEmailResponse409
from typing import cast


def _get_kwargs(
    *,
    body: PutV1WalletPayoutEmailBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/v1/wallet/payout-email",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    PutV1WalletPayoutEmailResponse200
    | PutV1WalletPayoutEmailResponse400
    | PutV1WalletPayoutEmailResponse401
    | PutV1WalletPayoutEmailResponse403
    | PutV1WalletPayoutEmailResponse409
    | None
):
    if response.status_code == 200:
        response_200 = PutV1WalletPayoutEmailResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = PutV1WalletPayoutEmailResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PutV1WalletPayoutEmailResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PutV1WalletPayoutEmailResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 409:
        response_409 = PutV1WalletPayoutEmailResponse409.from_dict(response.json())

        return response_409

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PutV1WalletPayoutEmailResponse200
    | PutV1WalletPayoutEmailResponse400
    | PutV1WalletPayoutEmailResponse401
    | PutV1WalletPayoutEmailResponse403
    | PutV1WalletPayoutEmailResponse409
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
    body: PutV1WalletPayoutEmailBody,
) -> Response[
    PutV1WalletPayoutEmailResponse200
    | PutV1WalletPayoutEmailResponse400
    | PutV1WalletPayoutEmailResponse401
    | PutV1WalletPayoutEmailResponse403
    | PutV1WalletPayoutEmailResponse409
]:
    """Set the PayPal email withdrawals are sent to

     Trimmed and lower-cased. 409 `invalid_transition` while a withdrawal is pending, so money in flight
    cannot be redirected.

    Args:
        body (PutV1WalletPayoutEmailBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PutV1WalletPayoutEmailResponse200 | PutV1WalletPayoutEmailResponse400 | PutV1WalletPayoutEmailResponse401 | PutV1WalletPayoutEmailResponse403 | PutV1WalletPayoutEmailResponse409]
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
    body: PutV1WalletPayoutEmailBody,
) -> (
    PutV1WalletPayoutEmailResponse200
    | PutV1WalletPayoutEmailResponse400
    | PutV1WalletPayoutEmailResponse401
    | PutV1WalletPayoutEmailResponse403
    | PutV1WalletPayoutEmailResponse409
    | None
):
    """Set the PayPal email withdrawals are sent to

     Trimmed and lower-cased. 409 `invalid_transition` while a withdrawal is pending, so money in flight
    cannot be redirected.

    Args:
        body (PutV1WalletPayoutEmailBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PutV1WalletPayoutEmailResponse200 | PutV1WalletPayoutEmailResponse400 | PutV1WalletPayoutEmailResponse401 | PutV1WalletPayoutEmailResponse403 | PutV1WalletPayoutEmailResponse409
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: PutV1WalletPayoutEmailBody,
) -> Response[
    PutV1WalletPayoutEmailResponse200
    | PutV1WalletPayoutEmailResponse400
    | PutV1WalletPayoutEmailResponse401
    | PutV1WalletPayoutEmailResponse403
    | PutV1WalletPayoutEmailResponse409
]:
    """Set the PayPal email withdrawals are sent to

     Trimmed and lower-cased. 409 `invalid_transition` while a withdrawal is pending, so money in flight
    cannot be redirected.

    Args:
        body (PutV1WalletPayoutEmailBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PutV1WalletPayoutEmailResponse200 | PutV1WalletPayoutEmailResponse400 | PutV1WalletPayoutEmailResponse401 | PutV1WalletPayoutEmailResponse403 | PutV1WalletPayoutEmailResponse409]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: PutV1WalletPayoutEmailBody,
) -> (
    PutV1WalletPayoutEmailResponse200
    | PutV1WalletPayoutEmailResponse400
    | PutV1WalletPayoutEmailResponse401
    | PutV1WalletPayoutEmailResponse403
    | PutV1WalletPayoutEmailResponse409
    | None
):
    """Set the PayPal email withdrawals are sent to

     Trimmed and lower-cased. 409 `invalid_transition` while a withdrawal is pending, so money in flight
    cannot be redirected.

    Args:
        body (PutV1WalletPayoutEmailBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PutV1WalletPayoutEmailResponse200 | PutV1WalletPayoutEmailResponse400 | PutV1WalletPayoutEmailResponse401 | PutV1WalletPayoutEmailResponse403 | PutV1WalletPayoutEmailResponse409
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
