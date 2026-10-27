from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.get_v1_demo_stream_response_400 import GetV1DemoStreamResponse400
from ...models.get_v1_demo_stream_response_404 import GetV1DemoStreamResponse404
from ...models.get_v1_demo_stream_response_429 import GetV1DemoStreamResponse429
from ...types import UNSET, Unset
from typing import cast


def _get_kwargs(
    *,
    recording: str | Unset = UNSET,
    speed: int | Unset = UNSET,
    from_: int | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["recording"] = recording

    params["speed"] = speed

    params["from"] = from_

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/demo/stream",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GetV1DemoStreamResponse400 | GetV1DemoStreamResponse404 | GetV1DemoStreamResponse429 | None:
    if response.status_code == 400:
        response_400 = GetV1DemoStreamResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 404:
        response_404 = GetV1DemoStreamResponse404.from_dict(response.json())

        return response_404

    if response.status_code == 429:
        response_429 = GetV1DemoStreamResponse429.from_dict(response.json())

        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[GetV1DemoStreamResponse400 | GetV1DemoStreamResponse404 | GetV1DemoStreamResponse429]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    recording: str | Unset = UNSET,
    speed: int | Unset = UNSET,
    from_: int | Unset = UNSET,
) -> Response[GetV1DemoStreamResponse400 | GetV1DemoStreamResponse404 | GetV1DemoStreamResponse429]:
    """Replay a recorded run (Server-Sent Events)

     No auth. `text/event-stream`. Replays `recording` (default: the featured one; 404 `not_found` when
    there is none) at `speed` 1 or 4. Each message has `id` (the event's seq), `event` (its type) and
    `data` (a ReplayEvent: `offsetMs` and the ArenaEvent). Events are sent when their time comes: the
    recorded gap divided by `speed`, at most 3 seconds. `from` resumes after that seq. Ends with `event:
    end`. A comment line every 15 seconds is the heartbeat. Rate limited with the other demo routes (30
    requests a minute per IP, 429 `rate_limited`).

    Args:
        recording (str | Unset):
        speed (int | Unset):
        from_ (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1DemoStreamResponse400 | GetV1DemoStreamResponse404 | GetV1DemoStreamResponse429]
    """

    kwargs = _get_kwargs(
        recording=recording,
        speed=speed,
        from_=from_,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    recording: str | Unset = UNSET,
    speed: int | Unset = UNSET,
    from_: int | Unset = UNSET,
) -> GetV1DemoStreamResponse400 | GetV1DemoStreamResponse404 | GetV1DemoStreamResponse429 | None:
    """Replay a recorded run (Server-Sent Events)

     No auth. `text/event-stream`. Replays `recording` (default: the featured one; 404 `not_found` when
    there is none) at `speed` 1 or 4. Each message has `id` (the event's seq), `event` (its type) and
    `data` (a ReplayEvent: `offsetMs` and the ArenaEvent). Events are sent when their time comes: the
    recorded gap divided by `speed`, at most 3 seconds. `from` resumes after that seq. Ends with `event:
    end`. A comment line every 15 seconds is the heartbeat. Rate limited with the other demo routes (30
    requests a minute per IP, 429 `rate_limited`).

    Args:
        recording (str | Unset):
        speed (int | Unset):
        from_ (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1DemoStreamResponse400 | GetV1DemoStreamResponse404 | GetV1DemoStreamResponse429
    """

    return sync_detailed(
        client=client,
        recording=recording,
        speed=speed,
        from_=from_,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    recording: str | Unset = UNSET,
    speed: int | Unset = UNSET,
    from_: int | Unset = UNSET,
) -> Response[GetV1DemoStreamResponse400 | GetV1DemoStreamResponse404 | GetV1DemoStreamResponse429]:
    """Replay a recorded run (Server-Sent Events)

     No auth. `text/event-stream`. Replays `recording` (default: the featured one; 404 `not_found` when
    there is none) at `speed` 1 or 4. Each message has `id` (the event's seq), `event` (its type) and
    `data` (a ReplayEvent: `offsetMs` and the ArenaEvent). Events are sent when their time comes: the
    recorded gap divided by `speed`, at most 3 seconds. `from` resumes after that seq. Ends with `event:
    end`. A comment line every 15 seconds is the heartbeat. Rate limited with the other demo routes (30
    requests a minute per IP, 429 `rate_limited`).

    Args:
        recording (str | Unset):
        speed (int | Unset):
        from_ (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetV1DemoStreamResponse400 | GetV1DemoStreamResponse404 | GetV1DemoStreamResponse429]
    """

    kwargs = _get_kwargs(
        recording=recording,
        speed=speed,
        from_=from_,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    recording: str | Unset = UNSET,
    speed: int | Unset = UNSET,
    from_: int | Unset = UNSET,
) -> GetV1DemoStreamResponse400 | GetV1DemoStreamResponse404 | GetV1DemoStreamResponse429 | None:
    """Replay a recorded run (Server-Sent Events)

     No auth. `text/event-stream`. Replays `recording` (default: the featured one; 404 `not_found` when
    there is none) at `speed` 1 or 4. Each message has `id` (the event's seq), `event` (its type) and
    `data` (a ReplayEvent: `offsetMs` and the ArenaEvent). Events are sent when their time comes: the
    recorded gap divided by `speed`, at most 3 seconds. `from` resumes after that seq. Ends with `event:
    end`. A comment line every 15 seconds is the heartbeat. Rate limited with the other demo routes (30
    requests a minute per IP, 429 `rate_limited`).

    Args:
        recording (str | Unset):
        speed (int | Unset):
        from_ (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetV1DemoStreamResponse400 | GetV1DemoStreamResponse404 | GetV1DemoStreamResponse429
    """

    return (
        await asyncio_detailed(
            client=client,
            recording=recording,
            speed=speed,
            from_=from_,
        )
    ).parsed
