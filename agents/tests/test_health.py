from fastapi.testclient import TestClient

from app import app


def test_health() -> None:
    res = TestClient(app).get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["service"] == "agents"
