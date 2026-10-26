from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.post_v1_agents_id_mandate_compile_body import PostV1AgentsIdMandateCompileBody
from ...models.post_v1_agents_id_mandate_compile_response_200 import PostV1AgentsIdMandateCompileResponse200
from ...models.post_v1_agents_id_mandate_compile_response_400 import PostV1AgentsIdMandateCompileResponse400
from ...models.post_v1_agents_id_mandate_compile_response_401 import PostV1AgentsIdMandateCompileResponse401
from ...models.post_v1_agents_id_mandate_compile_response_403 import PostV1AgentsIdMandateCompileResponse403
from ...models.post_v1_agents_id_mandate_compile_response_404 import PostV1AgentsIdMandateCompileResponse404
from ...models.post_v1_agents_id_mandate_compile_response_502 import PostV1AgentsIdMandateCompileResponse502
from typing import cast


def _get_kwargs(
    id: str,
    *,
    body: PostV1AgentsIdMandateCompileBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/agents/{id}/mandate/compile".format(
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
    PostV1AgentsIdMandateCompileResponse200
    | PostV1AgentsIdMandateCompileResponse400
    | PostV1AgentsIdMandateCompileResponse401
    | PostV1AgentsIdMandateCompileResponse403
    | PostV1AgentsIdMandateCompileResponse404
    | PostV1AgentsIdMandateCompileResponse502
    | None
):
    if response.status_code == 200:
        response_200 = PostV1AgentsIdMandateCompileResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = PostV1AgentsIdMandateCompileResponse400.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = PostV1AgentsIdMandateCompileResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = PostV1AgentsIdMandateCompileResponse403.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = PostV1AgentsIdMandateCompileResponse404.from_dict(response.json())

        return response_404

    if response.status_code == 502:
        response_502 = PostV1AgentsIdMandateCompileResponse502.from_dict(response.json())

        return response_502

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    PostV1AgentsIdMandateCompileResponse200
    | PostV1AgentsIdMandateCompileResponse400
    | PostV1AgentsIdMandateCompileResponse401
    | PostV1AgentsIdMandateCompileResponse403
    | PostV1AgentsIdMandateCompileResponse404
    | PostV1AgentsIdMandateCompileResponse502
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
    body: PostV1AgentsIdMandateCompileBody,
) -> Response[
    PostV1AgentsIdMandateCompileResponse200
    | PostV1AgentsIdMandateCompileResponse400
    | PostV1AgentsIdMandateCompileResponse401
    | PostV1AgentsIdMandateCompileResponse403
    | PostV1AgentsIdMandateCompileResponse404
    | PostV1AgentsIdMandateCompileResponse502
]:
    """Turn the owner's words into proposed mandate rules

     Uses the LLM gateway. Nothing is saved: review the rules, then PUT and confirm them as usual. 502
    `compile_failed` when the model is unavailable or its output isn't valid rules.

    Args:
        id (str):
        body (PostV1AgentsIdMandateCompileBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AgentsIdMandateCompileResponse200 | PostV1AgentsIdMandateCompileResponse400 | PostV1AgentsIdMandateCompileResponse401 | PostV1AgentsIdMandateCompileResponse403 | PostV1AgentsIdMandateCompileResponse404 | PostV1AgentsIdMandateCompileResponse502]
    """

    kwargs = _get_kwargs(
        id=id,
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    id: str,
    *,
    client: AuthenticatedClient,
    body: PostV1AgentsIdMandateCompileBody,
) -> (
    PostV1AgentsIdMandateCompileResponse200
    | PostV1AgentsIdMandateCompileResponse400
    | PostV1AgentsIdMandateCompileResponse401
    | PostV1AgentsIdMandateCompileResponse403
    | PostV1AgentsIdMandateCompileResponse404
    | PostV1AgentsIdMandateCompileResponse502
    | None
):
    """Turn the owner's words into proposed mandate rules

     Uses the LLM gateway. Nothing is saved: review the rules, then PUT and confirm them as usual. 502
    `compile_failed` when the model is unavailable or its output isn't valid rules.

    Args:
        id (str):
        body (PostV1AgentsIdMandateCompileBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AgentsIdMandateCompileResponse200 | PostV1AgentsIdMandateCompileResponse400 | PostV1AgentsIdMandateCompileResponse401 | PostV1AgentsIdMandateCompileResponse403 | PostV1AgentsIdMandateCompileResponse404 | PostV1AgentsIdMandateCompileResponse502
    """

    return sync_detailed(
        id=id,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient,
    body: PostV1AgentsIdMandateCompileBody,
) -> Response[
    PostV1AgentsIdMandateCompileResponse200
    | PostV1AgentsIdMandateCompileResponse400
    | PostV1AgentsIdMandateCompileResponse401
    | PostV1AgentsIdMandateCompileResponse403
    | PostV1AgentsIdMandateCompileResponse404
    | PostV1AgentsIdMandateCompileResponse502
]:
    """Turn the owner's words into proposed mandate rules

     Uses the LLM gateway. Nothing is saved: review the rules, then PUT and confirm them as usual. 502
    `compile_failed` when the model is unavailable or its output isn't valid rules.

    Args:
        id (str):
        body (PostV1AgentsIdMandateCompileBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostV1AgentsIdMandateCompileResponse200 | PostV1AgentsIdMandateCompileResponse400 | PostV1AgentsIdMandateCompileResponse401 | PostV1AgentsIdMandateCompileResponse403 | PostV1AgentsIdMandateCompileResponse404 | PostV1AgentsIdMandateCompileResponse502]
    """

    kwargs = _get_kwargs(
        id=id,
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient,
    body: PostV1AgentsIdMandateCompileBody,
) -> (
    PostV1AgentsIdMandateCompileResponse200
    | PostV1AgentsIdMandateCompileResponse400
    | PostV1AgentsIdMandateCompileResponse401
    | PostV1AgentsIdMandateCompileResponse403
    | PostV1AgentsIdMandateCompileResponse404
    | PostV1AgentsIdMandateCompileResponse502
    | None
):
    """Turn the owner's words into proposed mandate rules

     Uses the LLM gateway. Nothing is saved: review the rules, then PUT and confirm them as usual. 502
    `compile_failed` when the model is unavailable or its output isn't valid rules.

    Args:
        id (str):
        body (PostV1AgentsIdMandateCompileBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostV1AgentsIdMandateCompileResponse200 | PostV1AgentsIdMandateCompileResponse400 | PostV1AgentsIdMandateCompileResponse401 | PostV1AgentsIdMandateCompileResponse403 | PostV1AgentsIdMandateCompileResponse404 | PostV1AgentsIdMandateCompileResponse502
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
            body=body,
        )
    ).parsed
