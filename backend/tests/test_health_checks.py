from fastapi.testclient import TestClient

from app.api.routes import health as health_module
from app.main import create_app


def test_health_returns_503_when_any_dependency_unhealthy(monkeypatch) -> None:
    monkeypatch.setenv("PYTEST_CURRENT_TEST", "")
    monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:///./dummy.db")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("MINIO_ENDPOINT", "http://localhost:9000")
    monkeypatch.setenv("MINIO_ACCESS_KEY", "minioadmin")
    monkeypatch.setenv("MINIO_SECRET_KEY", "minioadmin")

    async def fail_db():
        return False, "down"

    async def ok_storage():
        return True, "ok"

    async def ok_redis():
        return True, "ok"

    monkeypatch.setattr(health_module, "_check_db", fail_db)
    monkeypatch.setattr(health_module, "_check_storage", ok_storage)
    monkeypatch.setattr(health_module, "_check_redis", ok_redis)

    client = TestClient(create_app())
    response = client.get("/health")
    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "unhealthy"


def test_health_returns_200_when_all_dependencies_healthy(monkeypatch) -> None:
    async def ok_db():
        return True, "ok"

    async def ok_storage():
        return True, "ok"

    async def ok_redis():
        return True, "ok"

    monkeypatch.setattr(health_module, "_check_db", ok_db)
    monkeypatch.setattr(health_module, "_check_storage", ok_storage)
    monkeypatch.setattr(health_module, "_check_redis", ok_redis)

    client = TestClient(create_app())
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
