from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_bounties_id_fund_response_200 import PostV1BountiesIdFundResponse200
from ...models.post_v1_bounties_id_fund_response_400 import PostV1BountiesIdFundResponse400
from ...models.post_v1_bounties_id_fund_response_401 import PostV1BountiesIdFundResponse401
from ...models.post_v1_bounties_id_fund_response_403 import PostV1BountiesIdFundResponse403
from ...models.post_v1_bounties_id_fund_response_404 import PostV1BountiesIdFundResponse404
from ...models.post_v1_bounties_id_fund_response_409 import PostV1BountiesIdFundResponse409
from ...models.post_v1_bounties_id_fund_response_422 import PostV1BountiesIdFundResponse422
from ...models.post_v1_bounties_id_fund_response_502 import PostV1BountiesIdFundResponse502
from ...models.post_v1_bounties_id_fund_response_503 import PostV1BountiesIdFundResponse503
from typing import cast


def _get_kwargs(
    id: str,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/bounties/{id}/fund".format(
            id=quote(str(id), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    PostV1BountiesIdFundResponse200
    | PostV1BountiesIdFundResponse400
    | PostV1BountiesIdFundResponse401
    | PostV1BountiesIdFundResponse403
    | PostV1BountiesIdFundResponse404
    | PostV1BountiesIdFundResponse409
    | PostV1BountiesIdFundResponse422
    | PostV1BountiesIdFundResponse502
    | PostV1BountiesIdFundResponse503
    | None
):
    if response.status_code == 200:
        response_200 = PostV1BountiesIdFundResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = PostV1BountiesIdFundResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1BountiesIdFundResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1BountiesIdFundResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = PostV1BountiesIdFundResponse404.from_dict(response.json())

        return response_404

    if response.status_code == 409:
        response_409 = PostV1BountiesIdFundResponse409.from_dict(response.json())

        return response_409

    if response.status_code == 422:
        response_422 = PostV1BountiesIdFundResponse422.from_dict(response.json())

        return response_422

    if response.status_code == 502:
        response_502 = PostV1BountiesIdFundResponse502.from_dict(response.json())

        return response_502

    if response.status_code == 503:
        response_503 = PostV1BountiesIdFundResponse503.from_dict(response.json())

        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1BountiesIdFundResponse200
    | PostV1BountiesIdFundResponse400
    | PostV1BountiesIdFundResponse401
    | PostV1BountiesIdFundResponse403
    | PostV1BountiesIdFundResponse404
    | PostV1BountiesIdFundResponse409
    | PostV1BountiesIdFundResponse422
    | PostV1BountiesIdFundResponse502
    | PostV1BountiesIdFundResponse503
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
    PostV1BountiesIdFundResponse200
    | PostV1BountiesIdFundResponse400
    | PostV1BountiesIdFundResponse401
    | PostV1BountiesIdFundResponse403
    | PostV1BountiesIdFundResponse404
    | PostV1BountiesIdFundResponse409
    | PostV1BountiesIdFundResponse422
    | PostV1BountiesIdFundResponse502
    | PostV1BountiesIdFundResponse503
]:
    """Create the PayPal order that escrows a draft bounty

     Poster only (404 otherwise). The amount is the bounty's reward + fee, computed on the server; the
    body takes none. Returns only the PayPal order id for the JS SDK. Calling again while the order is
    open returns the same id. 503 `paypal_not_configured` without PayPal credentials; 502 `paypal_error`
    when PayPal refuses.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1BountiesIdFundResponse200 | PostV1BountiesIdFundResponse400 | PostV1BountiesIdFundResponse401 | PostV1BountiesIdFundResponse403 | PostV1BountiesIdFundResponse404 | PostV1BountiesIdFundResponse409 | PostV1BountiesIdFundResponse422 | PostV1BountiesIdFundResponse502 | PostV1BountiesIdFundResponse503]
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
    PostV1BountiesIdFundResponse200
    | PostV1BountiesIdFundResponse400
    | PostV1BountiesIdFundResponse401
    | PostV1BountiesIdFundResponse403
    | PostV1BountiesIdFundResponse404
    | PostV1BountiesIdFundResponse409
    | PostV1BountiesIdFundResponse422
    | PostV1BountiesIdFundResponse502
    | PostV1BountiesIdFundResponse503
    | None
):
    """Create the PayPal order that escrows a draft bounty

     Poster only (404 otherwise). The amount is the bounty's reward + fee, computed on the server; the
    body takes none. Returns only the PayPal order id for the JS SDK. Calling again while the order is
    open returns the same id. 503 `paypal_not_configured` without PayPal credentials; 502 `paypal_error`
    when PayPal refuses.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1BountiesIdFundResponse200 | PostV1BountiesIdFundResponse400 | PostV1BountiesIdFundResponse401 | PostV1BountiesIdFundResponse403 | PostV1BountiesIdFundResponse404 | PostV1BountiesIdFundResponse409 | PostV1BountiesIdFundResponse422 | PostV1BountiesIdFundResponse502 | PostV1BountiesIdFundResponse503
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
    PostV1BountiesIdFundResponse200
    | PostV1BountiesIdFundResponse400
    | PostV1BountiesIdFundResponse401
    | PostV1BountiesIdFundResponse403
    | PostV1BountiesIdFundResponse404
    | PostV1BountiesIdFundResponse409
    | PostV1BountiesIdFundResponse422
    | PostV1BountiesIdFundResponse502
    | PostV1BountiesIdFundResponse503
]:
    """Create the PayPal order that escrows a draft bounty

     Poster only (404 otherwise). The amount is the bounty's reward + fee, computed on the server; the
    body takes none. Returns only the PayPal order id for the JS SDK. Calling again while the order is
    open returns the same id. 503 `paypal_not_configured` without PayPal credentials; 502 `paypal_error`
    when PayPal refuses.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1BountiesIdFundResponse200 | PostV1BountiesIdFundResponse400 | PostV1BountiesIdFundResponse401 | PostV1BountiesIdFundResponse403 | PostV1BountiesIdFundResponse404 | PostV1BountiesIdFundResponse409 | PostV1BountiesIdFundResponse422 | PostV1BountiesIdFundResponse502 | PostV1BountiesIdFundResponse503]
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
    PostV1BountiesIdFundResponse200
    | PostV1BountiesIdFundResponse400
    | PostV1BountiesIdFundResponse401
    | PostV1BountiesIdFundResponse403
    | PostV1BountiesIdFundResponse404
    | PostV1BountiesIdFundResponse409
    | PostV1BountiesIdFundResponse422
    | PostV1BountiesIdFundResponse502
    | PostV1BountiesIdFundResponse503
    | None
):
    """Create the PayPal order that escrows a draft bounty

     Poster only (404 otherwise). The amount is the bounty's reward + fee, computed on the server; the
    body takes none. Returns only the PayPal order id for the JS SDK. Calling again while the order is
    open returns the same id. 503 `paypal_not_configured` without PayPal credentials; 502 `paypal_error`
    when PayPal refuses.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1BountiesIdFundResponse200 | PostV1BountiesIdFundResponse400 | PostV1BountiesIdFundResponse401 | PostV1BountiesIdFundResponse403 | PostV1BountiesIdFundResponse404 | PostV1BountiesIdFundResponse409 | PostV1BountiesIdFundResponse422 | PostV1BountiesIdFundResponse502 | PostV1BountiesIdFundResponse503
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
        )
    ).parsed
