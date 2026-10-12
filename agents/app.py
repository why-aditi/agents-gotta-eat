"""House agents HTTP service.

Runs as a Render free web service. The api will POST a wake route here when a
bounty opens (not built yet); for now it only serves GET /health.
"""

import structlog
from fastapi import FastAPI

VERSION = "0.1.0"  # keep in sync with pyproject.toml

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ]
)

app = FastAPI(title="gottaeat-agents", version=VERSION)


@app.get("/health")
def health() -> dict[str, object]:
    return {"ok": True, "service": "agents", "version": VERSION}
