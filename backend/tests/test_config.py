from app.core.config import get_settings


def test_settings_load_from_env(monkeypatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost:5432/db")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("MINIO_ENDPOINT", "http://localhost:9000")
    monkeypatch.setenv("MINIO_ACCESS_KEY", "minioadmin")
    monkeypatch.setenv("MINIO_SECRET_KEY", "minioadmin")
    monkeypatch.setenv("JWT_SECRET_KEY", "dev-secret")

    settings = get_settings()
    assert settings.database_url.endswith("/db")
    assert settings.redis_url.startswith("redis://")
    assert settings.minio_endpoint.startswith("http")
    assert settings.jwt_algorithm == "HS256"
