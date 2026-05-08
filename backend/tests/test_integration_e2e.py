import io
import os
import time
import uuid
from urllib.parse import urlparse

import httpx
import pytest
from minio import Minio


pytestmark = pytest.mark.integration


def _should_run() -> bool:
    return os.getenv("RUN_INTEGRATION_TESTS") == "1"


def _require_integration_enabled() -> None:
    if not _should_run():
        pytest.skip("set RUN_INTEGRATION_TESTS=1 to run integration tests")


def _base_url() -> str:
    return os.getenv("HERSHEYS_BASE_URL") or os.getenv("BASE_URL") or "http://localhost:8000"


def _postgres_dsn() -> str:
    dsn = (
        os.getenv("HERSHEYS_DATABASE_URL")
        or os.getenv("DATABASE_URL")
        or "postgresql://hersheys:hersheys@localhost:5432/hersheys_cv"
    )
    if "sslmode=" not in dsn:
        dsn = f"{dsn}{'&' if '?' in dsn else '?'}sslmode=disable"
    return dsn


def _minio_config() -> tuple[str, str, str, str]:
    endpoint = (
        os.getenv("HERSHEYS_MINIO_ENDPOINT")
        or os.getenv("MINIO_ENDPOINT")
        or "http://localhost:9000"
    )
    access_key = os.getenv("HERSHEYS_MINIO_ACCESS_KEY") or os.getenv("MINIO_ACCESS_KEY") or "minioadmin"
    secret_key = os.getenv("HERSHEYS_MINIO_SECRET_KEY") or os.getenv("MINIO_SECRET_KEY") or "minioadmin"
    bucket = os.getenv("HERSHEYS_MINIO_BUCKET") or os.getenv("MINIO_BUCKET") or "hersheys-cv-storage"
    return endpoint, access_key, secret_key, bucket


def _minio_client() -> tuple[Minio, str]:
    endpoint, access_key, secret_key, bucket = _minio_config()
    parsed = urlparse(endpoint)
    netloc = parsed.netloc or parsed.path
    secure = parsed.scheme == "https"
    client = Minio(netloc, access_key=access_key, secret_key=secret_key, secure=secure)
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)
    return client, bucket


def _minimal_jpeg() -> bytes:
    return b"\xff\xd8\xff" + b"\x00\x00" + b"\xff\xd9"


def _login(client: httpx.Client) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "hersheys", "password": "cv-hersheys"},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert "access_token" in payload
    return payload["access_token"]


def test_integration_database_operations() -> None:
    _require_integration_enabled()
    base_url = _base_url()
    http_client = httpx.Client(base_url=base_url, timeout=10.0)
    try:
        health = http_client.get("/health")
        assert health.status_code == 200, health.text
        payload = health.json()
        assert payload["checks"]["database"]["ok"] is True
        _ = _login(http_client)
    finally:
        http_client.close()


def test_integration_storage_operations() -> None:
    _require_integration_enabled()
    client, bucket = _minio_client()

    object_name = f"integration-tests/{uuid.uuid4().hex}.txt"
    payload = b"hersheys-cv-integration"
    client.put_object(
        bucket,
        object_name,
        io.BytesIO(payload),
        length=len(payload),
        content_type="text/plain",
    )
    client.stat_object(bucket, object_name)
    response = client.get_object(bucket, object_name)
    try:
        assert response.read() == payload
    finally:
        response.close()
        response.release_conn()
        client.remove_object(bucket, object_name)


def test_integration_end_to_end_upload_process_result() -> None:
    _require_integration_enabled()
    base_url = _base_url()

    http_client = httpx.Client(base_url=base_url, timeout=10.0)
    try:
        token = _login(http_client)
        headers = {"Authorization": f"Bearer {token}"}

        upload = http_client.post(
            "/api/v1/images",
            headers=headers,
            files={"file": ("photo.jpg", _minimal_jpeg(), "image/jpeg")},
        )
        assert upload.status_code == 201, upload.text
        image_id = upload.json()["id"]

        minio_client, bucket = _minio_client()
        minio_client.stat_object(bucket, f"uploads/{image_id}.jpeg")

        deadline = time.time() + 30.0
        last_items: list[dict] | None = None
        while time.time() < deadline:
            results = http_client.get("/api/v1/results", headers=headers, params={"page": 1, "limit": 100})
            assert results.status_code == 200, results.text
            last_items = results.json().get("items") or []
            for item in last_items:
                if item.get("image_id") == image_id:
                    if item.get("status") == "processed":
                        payload = item.get("results") or {}
                        assert payload.get("placeholder") is True
                        sales = payload.get("sales") or {}
                        assert sales.get("product", {}).get("brand") == "Hershey's"
                        assert len(sales.get("series30d") or []) == 30
                        assert 3 <= len(sales.get("topStores") or []) <= 5
                        return
                    if item.get("status") == "processing_failed":
                        pytest.fail(f"processing failed: {item}")
            time.sleep(1.0)

        pytest.fail(f"timed out waiting for processing result; last_items={last_items}")
    finally:
        http_client.close()
