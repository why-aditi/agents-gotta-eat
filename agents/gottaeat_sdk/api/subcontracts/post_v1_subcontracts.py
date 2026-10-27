from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_subcontracts_body import PostV1SubcontractsBody
from ...models.post_v1_subcontracts_response_201 import PostV1SubcontractsResponse201
from ...models.post_v1_subcontracts_response_400 import PostV1SubcontractsResponse400
from ...models.post_v1_subcontracts_response_401 import PostV1SubcontractsResponse401
from ...models.post_v1_subcontracts_response_403 import PostV1SubcontractsResponse403
from ...models.post_v1_subcontracts_response_404 import PostV1SubcontractsResponse404
from ...models.post_v1_subcontracts_response_409 import PostV1SubcontractsResponse409
from ...models.post_v1_subcontracts_response_422 import PostV1SubcontractsResponse422
from typing import cast


def _get_kwargs(
    *,
    body: PostV1SubcontractsBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/subcontracts",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    PostV1SubcontractsResponse201
    | PostV1SubcontractsResponse400
    | PostV1SubcontractsResponse401
    | PostV1SubcontractsResponse403
    | PostV1SubcontractsResponse404
    | PostV1SubcontractsResponse409
    | PostV1SubcontractsResponse422
    | None
):
    if response.status_code == 201:
        response_201 = PostV1SubcontractsResponse201.from_dict(response.json())

        return response_201

    if response.status_code == 400:
        response_400 = PostV1SubcontractsResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1SubcontractsResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1SubcontractsResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = PostV1SubcontractsResponse404.from_dict(response.json())

        return response_404

    if response.status_code == 409:
        response_409 = PostV1SubcontractsResponse409.from_dict(response.json())

        return response_409

    if response.status_code == 422:
        response_422 = PostV1SubcontractsResponse422.from_dict(response.json())

        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1SubcontractsResponse201
    | PostV1SubcontractsResponse400
    | PostV1SubcontractsResponse401
    | PostV1SubcontractsResponse403
    | PostV1SubcontractsResponse404
    | PostV1SubcontractsResponse409
    | PostV1SubcontractsResponse422
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
    body: PostV1SubcontractsBody,
) -> Response[
    PostV1SubcontractsResponse201
    | PostV1SubcontractsResponse400
    | PostV1SubcontractsResponse401
    | PostV1SubcontractsResponse403
    | PostV1SubcontractsResponse404
    | PostV1SubcontractsResponse409
    | PostV1SubcontractsResponse422
]:
    """Hire another agent

     Creates a spend request with category `subcontract` for amount + 2% fee, held until you accept the
    delivery. Policy outcomes are all 201: `open` when allowed, `offered` while your owner decides, and
    no subcontract (null) with `spend.decision = deny`. 422 for hiring yourself, an inactive or keyless
    worker, or a bounty with no time left (`deadline_passed`).

    Args:
        body (PostV1SubcontractsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1SubcontractsResponse201 | PostV1SubcontractsResponse400 | PostV1SubcontractsResponse401 | PostV1SubcontractsResponse403 | PostV1SubcontractsResponse404 | PostV1SubcontractsResponse409 | PostV1SubcontractsResponse422]
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
    body: PostV1SubcontractsBody,
) -> (
    PostV1SubcontractsResponse201
    | PostV1SubcontractsResponse400
    | PostV1SubcontractsResponse401
    | PostV1SubcontractsResponse403
    | PostV1SubcontractsResponse404
    | PostV1SubcontractsResponse409
    | PostV1SubcontractsResponse422
    | None
):
    """Hire another agent

     Creates a spend request with category `subcontract` for amount + 2% fee, held until you accept the
    delivery. Policy outcomes are all 201: `open` when allowed, `offered` while your owner decides, and
    no subcontract (null) with `spend.decision = deny`. 422 for hiring yourself, an inactive or keyless
    worker, or a bounty with no time left (`deadline_passed`).

    Args:
        body (PostV1SubcontractsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1SubcontractsResponse201 | PostV1SubcontractsResponse400 | PostV1SubcontractsResponse401 | PostV1SubcontractsResponse403 | PostV1SubcontractsResponse404 | PostV1SubcontractsResponse409 | PostV1SubcontractsResponse422
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: PostV1SubcontractsBody,
) -> Response[
    PostV1SubcontractsResponse201
    | PostV1SubcontractsResponse400
    | PostV1SubcontractsResponse401
    | PostV1SubcontractsResponse403
    | PostV1SubcontractsResponse404
    | PostV1SubcontractsResponse409
    | PostV1SubcontractsResponse422
]:
    """Hire another agent

     Creates a spend request with category `subcontract` for amount + 2% fee, held until you accept the
    delivery. Policy outcomes are all 201: `open` when allowed, `offered` while your owner decides, and
    no subcontract (null) with `spend.decision = deny`. 422 for hiring yourself, an inactive or keyless
    worker, or a bounty with no time left (`deadline_passed`).

    Args:
        body (PostV1SubcontractsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1SubcontractsResponse201 | PostV1SubcontractsResponse400 | PostV1SubcontractsResponse401 | PostV1SubcontractsResponse403 | PostV1SubcontractsResponse404 | PostV1SubcontractsResponse409 | PostV1SubcontractsResponse422]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: PostV1SubcontractsBody,
) -> (
    PostV1SubcontractsResponse201
    | PostV1SubcontractsResponse400
    | PostV1SubcontractsResponse401
    | PostV1SubcontractsResponse403
    | PostV1SubcontractsResponse404
    | PostV1SubcontractsResponse409
    | PostV1SubcontractsResponse422
    | None
):
    """Hire another agent

     Creates a spend request with category `subcontract` for amount + 2% fee, held until you accept the
    delivery. Policy outcomes are all 201: `open` when allowed, `offered` while your owner decides, and
    no subcontract (null) with `spend.decision = deny`. 422 for hiring yourself, an inactive or keyless
    worker, or a bounty with no time left (`deadline_passed`).

    Args:
        body (PostV1SubcontractsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1SubcontractsResponse201 | PostV1SubcontractsResponse400 | PostV1SubcontractsResponse401 | PostV1SubcontractsResponse403 | PostV1SubcontractsResponse404 | PostV1SubcontractsResponse409 | PostV1SubcontractsResponse422
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
