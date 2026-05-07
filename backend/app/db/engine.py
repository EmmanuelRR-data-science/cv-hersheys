import os

from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.core.config import get_settings


def _to_async_database_url(database_url: str) -> str:
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+asyncpg://", 1)
    return database_url


_engine: AsyncEngine | None = None
_engine_pid: int | None = None


def get_async_engine() -> AsyncEngine:
    global _engine
    global _engine_pid

    pid = os.getpid()
    if _engine is None or _engine_pid != pid:
        settings = get_settings()
        _engine = create_async_engine(
            _to_async_database_url(settings.database_url),
            pool_pre_ping=True,
        )
        _engine_pid = pid
    return _engine


def _clear_async_engine_cache() -> None:
    global _engine
    global _engine_pid
    _engine = None
    _engine_pid = None


setattr(get_async_engine, "cache_clear", _clear_async_engine_cache)
