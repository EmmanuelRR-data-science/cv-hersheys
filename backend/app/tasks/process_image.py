import asyncio
import uuid
from datetime import UTC, datetime
from time import perf_counter

from celery import Task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.celery_app import celery_app
from app.core.config import get_settings
from app.db.engine import _to_async_database_url
from app.models.image import Image
from app.models.result import ProcessingResult
from app.services.storage import ensure_bucket, get_bytes

__import__("app.models.user")


async def _process_image(session: AsyncSession, image_id: str) -> None:
    try:
        parsed_id = uuid.UUID(image_id)
    except ValueError:
        return

    image = (await session.execute(select(Image).where(Image.id == parsed_id))).scalar_one_or_none()
    if image is None:
        return

    image.status = "processing"
    await session.commit()

    try:
        bucket = ensure_bucket()
        _ = get_bytes(bucket=bucket, object_name=image.storage_path)
    except Exception:
        image.status = "processing_failed"
        session.add(
            ProcessingResult(
                image_id=image.id,
                status="processing_failed",
                results=None,
                processed_at=datetime.now(tz=UTC),
                processing_time_ms=None,
                error_message="storage fetch failed",
            )
        )
        await session.commit()
        return

    started = perf_counter()
    now = datetime.now(tz=UTC)
    result = ProcessingResult(
        image_id=image.id,
        status="processed",
        results={"placeholder": True},
        processed_at=now,
        processing_time_ms=int((perf_counter() - started) * 1000),
        error_message=None,
    )
    session.add(result)
    image.status = "processed"
    await session.commit()


@celery_app.task(bind=True, max_retries=3, name="app.tasks.process_image.process_image")
def process_image(self: Task, image_id: str) -> None:
    settings = get_settings()
    engine = create_async_engine(
        _to_async_database_url(settings.database_url),
        poolclass=NullPool,
        pool_pre_ping=True,
    )
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)

    async def run() -> None:
        try:
            async with sessionmaker() as session:
                await _process_image(session, image_id)
        finally:
            await engine.dispose()

    try:
        asyncio.run(run())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=5) from exc
