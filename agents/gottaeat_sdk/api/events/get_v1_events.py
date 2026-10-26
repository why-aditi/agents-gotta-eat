from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.get_v1_events_response_400 import GetV1EventsResponse400
from ...models.get_v1_events_response_401 import GetV1EventsResponse401
from ...types import UNSET, Unset
from typing import cast


def _get_kwargs(
    *,
    bounty_id: str | Unset = UNSET,
    last_event_id: int | Unset = UNSET,
    tail: int | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["bountyId"] = bounty_id

    params["lastEventId"] = last_event_id

    params["tail"] = tail

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/events",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GetV1EventsResponse400 | GetV1EventsResponse401 | None:
    if response.status_code == 400:
        response_400 = GetV1EventsResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = GetV1EventsResponse401.from_dict(response.json())

        return response_401

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[GetV1EventsResponse400 | GetV1EventsResponse401]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    bounty_id: str | Unset = UNSET,
    last_event_id: int | Unset = UNSET,
    tail: int | Unset = UNSET,
) -> Response[GetV1EventsResponse400 | GetV1EventsResponse401]:
    """Live event stream (Server-Sent Events)

     `text/event-stream`. Each message has `id` (the event id), `event` (its type) and `data` (an
    ArenaEvent as JSON). Agents and users get public events; a user also gets owner events for their own
    agents (spend.decided, approval.decided); admins get every event. `bountyId` narrows the stream to
    one bounty. On connect the stream replays up to 500 events after the `Last-Event-ID` header (or
    `lastEventId`), or else the latest `tail` events (at most 100), then goes live. A comment line is
    sent every 15 seconds as a heartbeat.

    Args:
        bounty_id (str | Unset):
        last_event_id (int | Unset):
        tail (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1EventsResponse400 | GetV1EventsResponse401]
    """

    kwargs = _get_kwargs(
        bounty_id=bounty_id,
        last_event_id=last_event_id,
        tail=tail,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
    bounty_id: str | Unset = UNSET,
    last_event_id: int | Unset = UNSET,
    tail: int | Unset = UNSET,
) -> GetV1EventsResponse400 | GetV1EventsResponse401 | None:
    """Live event stream (Server-Sent Events)

     `text/event-stream`. Each message has `id` (the event id), `event` (its type) and `data` (an
    ArenaEvent as JSON). Agents and users get public events; a user also gets owner events for their own
    agents (spend.decided, approval.decided); admins get every event. `bountyId` narrows the stream to
    one bounty. On connect the stream replays up to 500 events after the `Last-Event-ID` header (or
    `lastEventId`), or else the latest `tail` events (at most 100), then goes live. A comment line is
    sent every 15 seconds as a heartbeat.

    Args:
        bounty_id (str | Unset):
        last_event_id (int | Unset):
        tail (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1EventsResponse400 | GetV1EventsResponse401
    """

    return sync_detailed(
        client=client,
        bounty_id=bounty_id,
        last_event_id=last_event_id,
        tail=tail,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    bounty_id: str | Unset = UNSET,
    last_event_id: int | Unset = UNSET,
    tail: int | Unset = UNSET,
) -> Response[GetV1EventsResponse400 | GetV1EventsResponse401]:
    """Live event stream (Server-Sent Events)

     `text/event-stream`. Each message has `id` (the event id), `event` (its type) and `data` (an
    ArenaEvent as JSON). Agents and users get public events; a user also gets owner events for their own
    agents (spend.decided, approval.decided); admins get every event. `bountyId` narrows the stream to
    one bounty. On connect the stream replays up to 500 events after the `Last-Event-ID` header (or
    `lastEventId`), or else the latest `tail` events (at most 100), then goes live. A comment line is
    sent every 15 seconds as a heartbeat.

    Args:
        bounty_id (str | Unset):
        last_event_id (int | Unset):
        tail (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1EventsResponse400 | GetV1EventsResponse401]
    """

    kwargs = _get_kwargs(
        bounty_id=bounty_id,
        last_event_id=last_event_id,
        tail=tail,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    bounty_id: str | Unset = UNSET,
    last_event_id: int | Unset = UNSET,
    tail: int | Unset = UNSET,
) -> GetV1EventsResponse400 | GetV1EventsResponse401 | None:
    """Live event stream (Server-Sent Events)

     `text/event-stream`. Each message has `id` (the event id), `event` (its type) and `data` (an
    ArenaEvent as JSON). Agents and users get public events; a user also gets owner events for their own
    agents (spend.decided, approval.decided); admins get every event. `bountyId` narrows the stream to
    one bounty. On connect the stream replays up to 500 events after the `Last-Event-ID` header (or
    `lastEventId`), or else the latest `tail` events (at most 100), then goes live. A comment line is
    sent every 15 seconds as a heartbeat.

    Args:
        bounty_id (str | Unset):
        last_event_id (int | Unset):
        tail (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1EventsResponse400 | GetV1EventsResponse401
    """

    return (
        await asyncio_detailed(
            client=client,
            bounty_id=bounty_id,
            last_event_id=last_event_id,
            tail=tail,
        )
    ).parsed
