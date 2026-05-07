import os

import httpx
import pytest

pytestmark = pytest.mark.integration


def _should_run() -> bool:
    return os.getenv("RUN_INTEGRATION_TESTS") == "1"


def _require_integration_enabled() -> None:
    if not _should_run():
        pytest.skip("set RUN_INTEGRATION_TESTS=1 to run integration tests")


def _dashboard_url() -> str:
    return os.getenv("HERSHEYS_DASHBOARD_URL") or os.getenv("DASHBOARD_URL") or "http://localhost:5173"


def _mobile_url() -> str:
    return os.getenv("HERSHEYS_MOBILE_URL") or os.getenv("MOBILE_URL") or "http://localhost:5174"


def test_dashboard_health_is_json_ok() -> None:
    _require_integration_enabled()
    client = httpx.Client(base_url=_dashboard_url(), timeout=10.0, follow_redirects=True)
    try:
        resp = client.get("/health")
        assert resp.status_code == 200, resp.text
        assert resp.headers.get("content-type", "").startswith("application/json")
        assert resp.json() == {"status": "ok"}
    finally:
        client.close()


def test_dashboard_root_and_deep_link_render() -> None:
    _require_integration_enabled()
    client = httpx.Client(base_url=_dashboard_url(), timeout=10.0, follow_redirects=True)
    try:
        root = client.get("/")
        assert root.status_code == 200, root.text
        assert "text/html" in root.headers.get("content-type", "")

        deep = client.get("/results/demo-id")
        assert deep.status_code == 200, deep.text
        assert "text/html" in deep.headers.get("content-type", "")
    finally:
        client.close()


def test_mobile_root_renders() -> None:
    _require_integration_enabled()
    client = httpx.Client(base_url=_mobile_url(), timeout=10.0, follow_redirects=True)
    try:
        root = client.get("/")
        assert root.status_code == 200, root.text
        assert "text/html" in root.headers.get("content-type", "")
    finally:
        client.close()

