import json
import logging

from fastapi.testclient import TestClient

from app.main import create_app


def test_request_logging_emits_method_path_status_and_latency(caplog) -> None:
    caplog.set_level(logging.INFO)
    client = TestClient(create_app())
    response = client.get("/health")
    assert response.status_code in {200, 503}

    records = [r for r in caplog.records if r.name == "app.request"]
    assert records
    payload = json.loads(records[-1].message)
    assert payload["method"] == "GET"
    assert payload["path"] == "/health"
    assert payload["status_code"] in {200, 503}
    assert isinstance(payload["duration_ms"], int)
    assert payload["duration_ms"] >= 0
    assert payload["request_id"]
