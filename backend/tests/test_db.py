from app.core.config import get_settings
from app.db.engine import get_async_engine


def test_get_async_engine_uses_asyncpg_driver(monkeypatch) -> None:
    get_settings.cache_clear()
    get_async_engine.cache_clear()

    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost:5432/db")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("MINIO_ENDPOINT", "http://localhost:9000")
    monkeypatch.setenv("MINIO_ACCESS_KEY", "minioadmin")
    monkeypatch.setenv("MINIO_SECRET_KEY", "minioadmin")
    monkeypatch.setenv("JWT_SECRET_KEY", "dev-secret")

    engine = get_async_engine()
    assert engine.url.drivername == "postgresql+asyncpg"
