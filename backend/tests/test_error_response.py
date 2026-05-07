from fastapi.testclient import TestClient

from app.main import create_app


def test_errors_use_standard_shape_for_missing_token() -> None:
    client = TestClient(create_app())
    response = client.get("/api/v1/me")
    assert response.status_code == 401
    body = response.json()
    assert set(body.keys()) == {"error", "message", "request_id", "timestamp"}
    assert body["error"]
    assert body["message"]
    assert body["request_id"]
    assert body["timestamp"]
