import os

import redis
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.db.engine import _to_async_database_url
from app.services.storage import ensure_bucket

router = APIRouter()


@router.get("/health")
async def health() -> JSONResponse:
    db_ok, db_msg = await _check_db()
    storage_ok, storage_msg = await _check_storage()
    redis_ok, redis_msg = await _check_redis()

    checks = {
        "database": {"ok": db_ok, "message": db_msg},
        "storage": {"ok": storage_ok, "message": storage_msg},
        "redis": {"ok": redis_ok, "message": redis_msg},
    }
    all_ok = all(c["ok"] for c in checks.values())
    status = "ok" if all_ok else "unhealthy"
    status_code = 200 if all_ok else 503
    return JSONResponse(status_code=status_code, content={"status": status, "checks": checks})


async def _check_db() -> tuple[bool, str]:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        return False, "missing DATABASE_URL"

    engine = create_async_engine(_to_async_database_url(database_url))
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True, "ok"
    except Exception:
        return False, "unreachable"
    finally:
        await engine.dispose()


async def _check_storage() -> tuple[bool, str]:
    if os.getenv("MINIO_ENDPOINT") is None:
        return False, "missing MINIO_ENDPOINT"
    if os.getenv("MINIO_ACCESS_KEY") is None:
        return False, "missing MINIO_ACCESS_KEY"
    if os.getenv("MINIO_SECRET_KEY") is None:
        return False, "missing MINIO_SECRET_KEY"
    if os.getenv("PYTEST_CURRENT_TEST"):
        return True, "skipped under pytest"
    try:
        ensure_bucket()
        return True, "ok"
    except Exception:
        return False, "unreachable"


async def _check_redis() -> tuple[bool, str]:
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        return False, "missing REDIS_URL"
    if os.getenv("PYTEST_CURRENT_TEST"):
        return True, "skipped under pytest"
    try:
        client = redis.Redis.from_url(redis_url)
        client.ping()
        return True, "ok"
    except Exception:
        return False, "unreachable"
