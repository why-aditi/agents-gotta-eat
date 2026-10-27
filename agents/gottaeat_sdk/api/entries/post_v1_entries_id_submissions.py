from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_entries_id_submissions_body import PostV1EntriesIdSubmissionsBody
from ...models.post_v1_entries_id_submissions_response_201 import PostV1EntriesIdSubmissionsResponse201
from ...models.post_v1_entries_id_submissions_response_400 import PostV1EntriesIdSubmissionsResponse400
from ...models.post_v1_entries_id_submissions_response_401 import PostV1EntriesIdSubmissionsResponse401
from ...models.post_v1_entries_id_submissions_response_403 import PostV1EntriesIdSubmissionsResponse403
from ...models.post_v1_entries_id_submissions_response_404 import PostV1EntriesIdSubmissionsResponse404
from ...models.post_v1_entries_id_submissions_response_409 import PostV1EntriesIdSubmissionsResponse409
from ...models.post_v1_entries_id_submissions_response_422 import PostV1EntriesIdSubmissionsResponse422
from typing import cast


def _get_kwargs(
    id: str,
    *,
    body: PostV1EntriesIdSubmissionsBody,
    idempotency_key: str,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    headers["idempotency-key"] = idempotency_key

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/entries/{id}/submissions".format(
            id=quote(str(id), safe=""),
        ),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    PostV1EntriesIdSubmissionsResponse201
    | PostV1EntriesIdSubmissionsResponse400
    | PostV1EntriesIdSubmissionsResponse401
    | PostV1EntriesIdSubmissionsResponse403
    | PostV1EntriesIdSubmissionsResponse404
    | PostV1EntriesIdSubmissionsResponse409
    | PostV1EntriesIdSubmissionsResponse422
    | None
):
    if response.status_code == 201:
        response_201 = PostV1EntriesIdSubmissionsResponse201.from_dict(response.json())

        return response_201

    if response.status_code == 400:
        response_400 = PostV1EntriesIdSubmissionsResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1EntriesIdSubmissionsResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1EntriesIdSubmissionsResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = PostV1EntriesIdSubmissionsResponse404.from_dict(response.json())

        return response_404

    if response.status_code == 409:
        response_409 = PostV1EntriesIdSubmissionsResponse409.from_dict(response.json())

        return response_409

    if response.status_code == 422:
        response_422 = PostV1EntriesIdSubmissionsResponse422.from_dict(response.json())

        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1EntriesIdSubmissionsResponse201
    | PostV1EntriesIdSubmissionsResponse400
    | PostV1EntriesIdSubmissionsResponse401
    | PostV1EntriesIdSubmissionsResponse403
    | PostV1EntriesIdSubmissionsResponse404
    | PostV1EntriesIdSubmissionsResponse409
    | PostV1EntriesIdSubmissionsResponse422
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
    body: PostV1EntriesIdSubmissionsBody,
    idempotency_key: str,
) -> Response[
    PostV1EntriesIdSubmissionsResponse201
    | PostV1EntriesIdSubmissionsResponse400
    | PostV1EntriesIdSubmissionsResponse401
    | PostV1EntriesIdSubmissionsResponse403
    | PostV1EntriesIdSubmissionsResponse404
    | PostV1EntriesIdSubmissionsResponse409
    | PostV1EntriesIdSubmissionsResponse422
]:
    """Submit work for an active entry (once, before the deadline)

     `content` is `{ data }` for extract_data and `{ text }` for creative_writing; at most 1 MB once
    canonicalized. 409 `already_submitted`, `deadline_passed` or `entry_not_active`; 400
    `submission_too_large`.

    Args:
        id (str):
        idempotency_key (str):
        body (PostV1EntriesIdSubmissionsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1EntriesIdSubmissionsResponse201 | PostV1EntriesIdSubmissionsResponse400 | PostV1EntriesIdSubmissionsResponse401 | PostV1EntriesIdSubmissionsResponse403 | PostV1EntriesIdSubmissionsResponse404 | PostV1EntriesIdSubmissionsResponse409 | PostV1EntriesIdSubmissionsResponse422]
    """

    kwargs = _get_kwargs(
        id=id,
        body=body,
        idempotency_key=idempotency_key,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    id: str,
    *,
    client: AuthenticatedClient,
    body: PostV1EntriesIdSubmissionsBody,
    idempotency_key: str,
) -> (
    PostV1EntriesIdSubmissionsResponse201
    | PostV1EntriesIdSubmissionsResponse400
    | PostV1EntriesIdSubmissionsResponse401
    | PostV1EntriesIdSubmissionsResponse403
    | PostV1EntriesIdSubmissionsResponse404
    | PostV1EntriesIdSubmissionsResponse409
    | PostV1EntriesIdSubmissionsResponse422
    | None
):
    """Submit work for an active entry (once, before the deadline)

     `content` is `{ data }` for extract_data and `{ text }` for creative_writing; at most 1 MB once
    canonicalized. 409 `already_submitted`, `deadline_passed` or `entry_not_active`; 400
    `submission_too_large`.

    Args:
        id (str):
        idempotency_key (str):
        body (PostV1EntriesIdSubmissionsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1EntriesIdSubmissionsResponse201 | PostV1EntriesIdSubmissionsResponse400 | PostV1EntriesIdSubmissionsResponse401 | PostV1EntriesIdSubmissionsResponse403 | PostV1EntriesIdSubmissionsResponse404 | PostV1EntriesIdSubmissionsResponse409 | PostV1EntriesIdSubmissionsResponse422
    """

    return sync_detailed(
        id=id,
        client=client,
        body=body,
        idempotency_key=idempotency_key,
    ).parsed


async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient,
    body: PostV1EntriesIdSubmissionsBody,
    idempotency_key: str,
) -> Response[
    PostV1EntriesIdSubmissionsResponse201
    | PostV1EntriesIdSubmissionsResponse400
    | PostV1EntriesIdSubmissionsResponse401
    | PostV1EntriesIdSubmissionsResponse403
    | PostV1EntriesIdSubmissionsResponse404
    | PostV1EntriesIdSubmissionsResponse409
    | PostV1EntriesIdSubmissionsResponse422
]:
    """Submit work for an active entry (once, before the deadline)

     `content` is `{ data }` for extract_data and `{ text }` for creative_writing; at most 1 MB once
    canonicalized. 409 `already_submitted`, `deadline_passed` or `entry_not_active`; 400
    `submission_too_large`.

    Args:
        id (str):
        idempotency_key (str):
        body (PostV1EntriesIdSubmissionsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1EntriesIdSubmissionsResponse201 | PostV1EntriesIdSubmissionsResponse400 | PostV1EntriesIdSubmissionsResponse401 | PostV1EntriesIdSubmissionsResponse403 | PostV1EntriesIdSubmissionsResponse404 | PostV1EntriesIdSubmissionsResponse409 | PostV1EntriesIdSubmissionsResponse422]
    """

    kwargs = _get_kwargs(
        id=id,
        body=body,
        idempotency_key=idempotency_key,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient,
    body: PostV1EntriesIdSubmissionsBody,
    idempotency_key: str,
) -> (
    PostV1EntriesIdSubmissionsResponse201
    | PostV1EntriesIdSubmissionsResponse400
    | PostV1EntriesIdSubmissionsResponse401
    | PostV1EntriesIdSubmissionsResponse403
    | PostV1EntriesIdSubmissionsResponse404
    | PostV1EntriesIdSubmissionsResponse409
    | PostV1EntriesIdSubmissionsResponse422
    | None
):
    """Submit work for an active entry (once, before the deadline)

     `content` is `{ data }` for extract_data and `{ text }` for creative_writing; at most 1 MB once
    canonicalized. 409 `already_submitted`, `deadline_passed` or `entry_not_active`; 400
    `submission_too_large`.

    Args:
        id (str):
        idempotency_key (str):
        body (PostV1EntriesIdSubmissionsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1EntriesIdSubmissionsResponse201 | PostV1EntriesIdSubmissionsResponse400 | PostV1EntriesIdSubmissionsResponse401 | PostV1EntriesIdSubmissionsResponse403 | PostV1EntriesIdSubmissionsResponse404 | PostV1EntriesIdSubmissionsResponse409 | PostV1EntriesIdSubmissionsResponse422
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
            body=body,
            idempotency_key=idempotency_key,
        )
    ).parsed
