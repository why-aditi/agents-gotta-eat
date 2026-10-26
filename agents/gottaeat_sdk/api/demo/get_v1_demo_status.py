from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.get_v1_demo_status_response_200 import GetV1DemoStatusResponse200
from ...models.get_v1_demo_status_response_429 import GetV1DemoStatusResponse429
from typing import cast


def _get_kwargs() -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/demo/status",
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GetV1DemoStatusResponse200 | GetV1DemoStatusResponse429 | None:
    if response.status_code == 200:
        response_200 = GetV1DemoStatusResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 429:
        response_429 = GetV1DemoStatusResponse429.from_dict(response.json())

        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[GetV1DemoStatusResponse200 | GetV1DemoStatusResponse429]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
) -> Response[GetV1DemoStatusResponse200 | GetV1DemoStatusResponse429]:
    """The featured recording and whether live mode is near its LLM budget

     No auth. `live.fallback` is true once today's gateway requests reach 80% of the daily budget: the
    web app then sends new visitors to the replay. Rate limited with the other demo routes.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1DemoStatusResponse200 | GetV1DemoStatusResponse429]
    """

    kwargs = _get_kwargs()

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
) -> GetV1DemoStatusResponse200 | GetV1DemoStatusResponse429 | None:
    """The featured recording and whether live mode is near its LLM budget

     No auth. `live.fallback` is true once today's gateway requests reach 80% of the daily budget: the
    web app then sends new visitors to the replay. Rate limited with the other demo routes.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1DemoStatusResponse200 | GetV1DemoStatusResponse429
    """

    return sync_detailed(
        client=client,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
) -> Response[GetV1DemoStatusResponse200 | GetV1DemoStatusResponse429]:
    """The featured recording and whether live mode is near its LLM budget

     No auth. `live.fallback` is true once today's gateway requests reach 80% of the daily budget: the
    web app then sends new visitors to the replay. Rate limited with the other demo routes.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1DemoStatusResponse200 | GetV1DemoStatusResponse429]
    """

    kwargs = _get_kwargs()

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
) -> GetV1DemoStatusResponse200 | GetV1DemoStatusResponse429 | None:
    """The featured recording and whether live mode is near its LLM budget

     No auth. `live.fallback` is true once today's gateway requests reach 80% of the daily budget: the
    web app then sends new visitors to the replay. Rate limited with the other demo routes.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1DemoStatusResponse200 | GetV1DemoStatusResponse429
    """

    return (
        await asyncio_detailed(
            client=client,
        )
    ).parsed
