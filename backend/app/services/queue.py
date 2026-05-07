import os

from celery.result import AsyncResult

from app.core.celery_app import celery_app


def enqueue_process_image(image_id: str) -> AsyncResult:
    if os.getenv("PYTEST_CURRENT_TEST"):
        raise RuntimeError("queue disabled under pytest")
    return celery_app.send_task("app.tasks.process_image.process_image", args=[image_id])
