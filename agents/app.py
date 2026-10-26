"""House agents HTTP service (Render free web service).

The lifespan starts the poller: every AGENTS_POLL_SECONDS each agent with a key lists open bounties and handles new
ones. The api POSTs /wake (X-Wake-Secret) when a bounty opens, which triggers an immediate poll.
"""

from __future__ import annotations

import hmac
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse

from common.config import Settings
from common.runner import Poller, build_workers

VERSION = "0.1.0"  # keep in sync with pyproject.toml

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ]
)
log = structlog.get_logger()


def default_poller(settings: Settings) -> Poller:
    return Poller(build_workers(settings), settings.poll_seconds)


def create_app(
    settings: Settings | None = None,
    make_poller: Callable[[Settings], Poller] = default_poller,
) -> FastAPI:
    state: dict[str, Poller] = {}

    def current_settings() -> Settings:
        return settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        poller = make_poller(current_settings())
        state["poller"] = poller
        poller.start()
        try:
            yield
        finally:
            await poller.stop()

    app = FastAPI(title="gottaeat-agents", version=VERSION, lifespan=lifespan)

    @app.get("/health")
    def health() -> dict[str, object]:
        return {"ok": True, "service": "agents", "version": VERSION}

    @app.post("/wake", status_code=202)
    def wake(x_wake_secret: str | None = Header(default=None)) -> JSONResponse:
        secret = current_settings().wake_secret
        given = x_wake_secret or ""
        # An unset secret disables the route.
        if not secret or not hmac.compare_digest(given.encode(), secret.encode()):
            raise HTTPException(status_code=401, detail="bad wake secret")
        poller = state.get("poller")
        if poller:
            poller.wake()
        log.info("wake")
        return JSONResponse({"ok": True}, status_code=202)

    return app


app = create_app()
