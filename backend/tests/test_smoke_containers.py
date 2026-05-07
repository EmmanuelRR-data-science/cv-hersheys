import os
import asyncio

import httpx
import pytest
import redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.db.engine import _to_async_database_url

pytestmark = pytest.mark.integration


def _require_integration_enabled() -> None:
    if os.getenv("RUN_INTEGRATION_TESTS") != "1":
        pytest.skip("set RUN_INTEGRATION_TESTS=1 to run integration tests")


def _base_url() -> str:
    return os.getenv("HERSHEYS_BASE_URL") or "http://backend-api:8000"


def _dashboard_url() -> str:
    return os.getenv("HERSHEYS_DASHBOARD_URL") or "http://dashboard:5173"


def _mobile_url() -> str:
    return os.getenv("HERSHEYS_MOBILE_URL") or "http://mobile-app:5174"


def _redis_url() -> str:
    return os.getenv("REDIS_URL") or "redis://redis:6379/0"


def _database_url() -> str:
    return os.getenv("HERSHEYS_DATABASE_URL") or os.getenv("DATABASE_URL") or ""

def _minio_url() -> str:
    endpoint = os.getenv("HERSHEYS_MINIO_ENDPOINT") or os.getenv("MINIO_ENDPOINT") or "http://minio:9000"
    return endpoint.rstrip("/")


def test_smoke_env_config_present() -> None:
    _require_integration_enabled()
    assert os.getenv("HERSHEYS_BASE_URL"), "missing HERSHEYS_BASE_URL"
    assert os.getenv("HERSHEYS_DASHBOARD_URL"), "missing HERSHEYS_DASHBOARD_URL"
    assert os.getenv("HERSHEYS_MOBILE_URL"), "missing HERSHEYS_MOBILE_URL"
    assert os.getenv("HERSHEYS_DATABASE_URL"), "missing HERSHEYS_DATABASE_URL"
    assert os.getenv("HERSHEYS_MINIO_ENDPOINT"), "missing HERSHEYS_MINIO_ENDPOINT"
    assert os.getenv("HERSHEYS_MINIO_ACCESS_KEY"), "missing HERSHEYS_MINIO_ACCESS_KEY"
    assert os.getenv("HERSHEYS_MINIO_SECRET_KEY"), "missing HERSHEYS_MINIO_SECRET_KEY"
    assert os.getenv("HERSHEYS_MINIO_BUCKET"), "missing HERSHEYS_MINIO_BUCKET"


def test_smoke_backend_health_ok() -> None:
    _require_integration_enabled()
    resp = httpx.get(f"{_base_url()}/health", timeout=10.0)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "ok"


def test_smoke_dashboard_health_ok() -> None:
    _require_integration_enabled()
    resp = httpx.get(f"{_dashboard_url()}/health", timeout=10.0)
    assert resp.status_code == 200, resp.text
    assert resp.headers.get("content-type", "").startswith("application/json")
    assert resp.json() == {"status": "ok"}


def test_smoke_mobile_root_ok() -> None:
    _require_integration_enabled()
    resp = httpx.get(f"{_mobile_url()}/", timeout=10.0)
    assert resp.status_code == 200, resp.text
    assert "text/html" in resp.headers.get("content-type", "")


def test_smoke_redis_ping() -> None:
    _require_integration_enabled()
    client = redis.Redis.from_url(_redis_url())
    assert client.ping() is True


def test_smoke_minio_live_ok() -> None:
    _require_integration_enabled()
    resp = httpx.get(f"{_minio_url()}/minio/health/live", timeout=10.0)
    assert resp.status_code == 200, resp.text


def test_smoke_postgres_select_1() -> None:
    _require_integration_enabled()
    database_url = _database_url()
    assert database_url, "missing HERSHEYS_DATABASE_URL (or DATABASE_URL)"

    async def _run() -> None:
        engine = create_async_engine(_to_async_database_url(database_url))
        try:
            async with engine.connect() as conn:
                result = await conn.execute(text("SELECT 1"))
                assert result.scalar_one() == 1
        finally:
            await engine.dispose()

    asyncio.run(_run())
