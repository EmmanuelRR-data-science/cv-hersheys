import json
import os
from dataclasses import dataclass
from io import BytesIO
from typing import Any
from urllib.parse import urlparse

from minio import Minio
from minio.error import S3Error


@dataclass(frozen=True)
class StorageLocation:
    bucket: str
    object_name: str


def _is_pytest() -> bool:
    return bool(os.getenv("PYTEST_CURRENT_TEST"))


def _client_from_env() -> tuple[Minio, str]:
    endpoint_raw = os.getenv("MINIO_ENDPOINT", "http://minio:9000")
    access_key = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    secret_key = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    bucket = os.getenv("MINIO_BUCKET", "hersheys-cv-storage")

    parsed = urlparse(endpoint_raw)
    if parsed.scheme in {"http", "https"}:
        endpoint = parsed.netloc
        secure = parsed.scheme == "https"
    else:
        endpoint = endpoint_raw
        secure = False

    return Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure), bucket


def ensure_bucket() -> str:
    if _is_pytest():
        return "hersheys-cv-storage"

    client, bucket = _client_from_env()
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)
    return bucket


def put_bytes(*, object_name: str, data: bytes, content_type: str | None = None) -> StorageLocation:
    if _is_pytest():
        return StorageLocation(bucket="hersheys-cv-storage", object_name=object_name)

    client, bucket = _client_from_env()
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)

    client.put_object(
        bucket_name=bucket,
        object_name=object_name,
        data=BytesIO(data),
        length=len(data),
        content_type=content_type,
    )
    return StorageLocation(bucket=bucket, object_name=object_name)


def get_bytes(*, bucket: str, object_name: str) -> bytes:
    if _is_pytest():
        return b""

    client, _ = _client_from_env()
    try:
        response = client.get_object(bucket, object_name)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()
    except S3Error as exc:
        raise FileNotFoundError(object_name) from exc


def put_json(*, object_name: str, payload: dict[str, Any]) -> StorageLocation:
    """Cache a JSON payload in MinIO under `object_name`.

    Used by the on-demand OCR proxy (`/api/v1/images/{id}/ocr_info`) to
    persist provider responses so repeated dashboard visits do not re-hit
    the upstream OCR. Mirrors `_annotated.jpeg` caching pattern.
    """

    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    return put_bytes(object_name=object_name, data=data, content_type="application/json")


def get_json(*, bucket: str, object_name: str) -> dict[str, Any]:
    """Load a cached JSON payload.

    Raises `FileNotFoundError` when the object is absent (caller decides
    whether to refetch from upstream) and `ValueError` when the cached
    bytes cannot be parsed as a JSON object.
    """

    raw = get_bytes(bucket=bucket, object_name=object_name)
    if not raw:
        raise FileNotFoundError(object_name)
    try:
        parsed = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"invalid JSON cache at {object_name}: {exc}") from exc
    if not isinstance(parsed, dict):
        raise ValueError(f"cached JSON at {object_name} is not an object")
    return parsed
