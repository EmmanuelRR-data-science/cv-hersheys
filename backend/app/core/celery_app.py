import os

from celery import Celery


def _broker_url() -> str:
    return os.getenv("REDIS_URL", "redis://redis:6379/0")


celery_app = Celery("hersheys_cv", broker=_broker_url(), backend=_broker_url())
celery_app.conf.task_acks_late = True
celery_app.conf.task_reject_on_worker_lost = True
celery_app.conf.broker_connection_retry_on_startup = True
celery_app.conf.task_default_queue = "default"
celery_app.autodiscover_tasks(["app"])
