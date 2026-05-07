from fastapi.testclient import TestClient

from app.main import create_app


def test_cors_preflight_includes_allow_origin_for_any_origin() -> None:
    client = TestClient(create_app())
    response = client.options(
        "/health",
        headers={
            "Origin": "http://example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") in {"*", "http://example.com"}
