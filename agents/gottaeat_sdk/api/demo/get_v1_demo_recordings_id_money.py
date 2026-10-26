from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.get_v1_demo_recordings_id_money_response_200 import GetV1DemoRecordingsIdMoneyResponse200
from ...models.get_v1_demo_recordings_id_money_response_400 import GetV1DemoRecordingsIdMoneyResponse400
from ...models.get_v1_demo_recordings_id_money_response_404 import GetV1DemoRecordingsIdMoneyResponse404
from ...models.get_v1_demo_recordings_id_money_response_429 import GetV1DemoRecordingsIdMoneyResponse429
from typing import cast


def _get_kwargs(
    id: str,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/demo/recordings/{id}/money".format(
            id=quote(str(id), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    GetV1DemoRecordingsIdMoneyResponse200
    | GetV1DemoRecordingsIdMoneyResponse400
    | GetV1DemoRecordingsIdMoneyResponse404
    | GetV1DemoRecordingsIdMoneyResponse429
    | None
):
    if response.status_code == 200:
        response_200 = GetV1DemoRecordingsIdMoneyResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = GetV1DemoRecordingsIdMoneyResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 404:
        response_404 = GetV1DemoRecordingsIdMoneyResponse404.from_dict(response.json())

        return response_404

    if response.status_code == 429:
        response_429 = GetV1DemoRecordingsIdMoneyResponse429.from_dict(response.json())

        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    GetV1DemoRecordingsIdMoneyResponse200
    | GetV1DemoRecordingsIdMoneyResponse400
    | GetV1DemoRecordingsIdMoneyResponse404
    | GetV1DemoRecordingsIdMoneyResponse429
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
    client: AuthenticatedClient | Client,
) -> Response[
    GetV1DemoRecordingsIdMoneyResponse200
    | GetV1DemoRecordingsIdMoneyResponse400
    | GetV1DemoRecordingsIdMoneyResponse404
    | GetV1DemoRecordingsIdMoneyResponse429
]:
    """PayPal sandbox ids from a recorded run

     No auth. One link per PayPal id on the recording's bounty events: the order and authorization when a
    bounty opened, the capture when it settled. Authorizations and captures link to the sandbox activity
    page; orders have no stable sandbox URL, so `url` is null. Dev-funded bounties have no ids. Payout
    ids are private and never listed. Rate limited with the other demo routes.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1DemoRecordingsIdMoneyResponse200 | GetV1DemoRecordingsIdMoneyResponse400 | GetV1DemoRecordingsIdMoneyResponse404 | GetV1DemoRecordingsIdMoneyResponse429]
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
    client: AuthenticatedClient | Client,
) -> (
    GetV1DemoRecordingsIdMoneyResponse200
    | GetV1DemoRecordingsIdMoneyResponse400
    | GetV1DemoRecordingsIdMoneyResponse404
    | GetV1DemoRecordingsIdMoneyResponse429
    | None
):
    """PayPal sandbox ids from a recorded run

     No auth. One link per PayPal id on the recording's bounty events: the order and authorization when a
    bounty opened, the capture when it settled. Authorizations and captures link to the sandbox activity
    page; orders have no stable sandbox URL, so `url` is null. Dev-funded bounties have no ids. Payout
    ids are private and never listed. Rate limited with the other demo routes.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1DemoRecordingsIdMoneyResponse200 | GetV1DemoRecordingsIdMoneyResponse400 | GetV1DemoRecordingsIdMoneyResponse404 | GetV1DemoRecordingsIdMoneyResponse429
    """

    return sync_detailed(
        id=id,
        client=client,
    ).parsed


async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
) -> Response[
    GetV1DemoRecordingsIdMoneyResponse200
    | GetV1DemoRecordingsIdMoneyResponse400
    | GetV1DemoRecordingsIdMoneyResponse404
    | GetV1DemoRecordingsIdMoneyResponse429
]:
    """PayPal sandbox ids from a recorded run

     No auth. One link per PayPal id on the recording's bounty events: the order and authorization when a
    bounty opened, the capture when it settled. Authorizations and captures link to the sandbox activity
    page; orders have no stable sandbox URL, so `url` is null. Dev-funded bounties have no ids. Payout
    ids are private and never listed. Rate limited with the other demo routes.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1DemoRecordingsIdMoneyResponse200 | GetV1DemoRecordingsIdMoneyResponse400 | GetV1DemoRecordingsIdMoneyResponse404 | GetV1DemoRecordingsIdMoneyResponse429]
    """

    kwargs = _get_kwargs(
        id=id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient | Client,
) -> (
    GetV1DemoRecordingsIdMoneyResponse200
    | GetV1DemoRecordingsIdMoneyResponse400
    | GetV1DemoRecordingsIdMoneyResponse404
    | GetV1DemoRecordingsIdMoneyResponse429
    | None
):
    """PayPal sandbox ids from a recorded run

     No auth. One link per PayPal id on the recording's bounty events: the order and authorization when a
    bounty opened, the capture when it settled. Authorizations and captures link to the sandbox activity
    page; orders have no stable sandbox URL, so `url` is null. Dev-funded bounties have no ids. Payout
    ids are private and never listed. Rate limited with the other demo routes.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1DemoRecordingsIdMoneyResponse200 | GetV1DemoRecordingsIdMoneyResponse400 | GetV1DemoRecordingsIdMoneyResponse404 | GetV1DemoRecordingsIdMoneyResponse429
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
        )
    ).parsed
