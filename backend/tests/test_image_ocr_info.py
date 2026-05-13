"""Tests for `GET /api/v1/images/{id}/ocr_info` endpoint.

Validates the on-demand OCR proxy + MinIO JSON cache behavior:
- Cache hit short-circuits the upstream OCR call.
- Cache miss triggers `fetch_image_info`, returns payload and writes cache.
- Upstream failure maps to 502 without poisoning the cache.
- Auth rules mirror the dashboard global view (authenticated users can read any image).
"""

from __future__ import annotations

import asyncio
import uuid
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.dependencies import get_db_session, get_settings_dep
from app.core.config import Settings
from app.core.security import hash_password
from app.db.base import Base
from app.main import create_app
from app.models.image import Image
from app.models.user import User
from app.services.ocr_external import OcrExternalError

JWT_SECRET = "dev-secret-dev-secret-dev-secret-dev-secret"


def _bootstrap_db(tmp_path: Path, fixture_name: str):
    db_path = tmp_path / fixture_name
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)
    return engine, sessionmaker


def _build_settings() -> Settings:
    return Settings(
        database_url="sqlite://",
        redis_url="redis://",
        minio_endpoint="http://minio",
        minio_access_key="minioadmin",
        minio_secret_key="minioadmin",
        jwt_secret_key=JWT_SECRET,
        ocr_api_base_url="http://ocr.test/apis/ocr",
        ocr_api_timeout_seconds=5.0,
    )


def _login(client: TestClient, username: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login", json={"username": username, "password": password}
    )
    return response.json()["access_token"]


def test_ocr_info_returns_cached_payload_without_calling_upstream(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine, sessionmaker = _bootstrap_db(tmp_path, "ocr_info_hit.db")
    image_id = uuid.uuid4()
    user_id = uuid.uuid4()
    storage_path = f"uploads/{image_id}.jpeg"

    async def init() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessionmaker() as session:
            session.add(
                User(
                    id=user_id,
                    username="u1",
                    password_hash=hash_password("pw"),
                    role="operator",
                    is_active=True,
                )
            )
            session.add(
                Image(
                    id=image_id,
                    user_id=user_id,
                    original_filename="photo.jpg",
                    storage_path=storage_path,
                    format="jpeg",
                    size_bytes=2048,
                    status="processed",
                )
            )
            await session.commit()

    asyncio.run(init())

    import app.api.routes.images as images_routes

    cached_payload = {
        "status_message": "Imagen procesada correctamente.",
        "filename": "photo.jpg",
        "total_productos": 18,
        "conteo_general": {"7 Mares Huichol": 5},
    }
    expected_cache_path = f"uploads/{image_id}_ocr_info.json"

    def fake_get_json(*, bucket: str, object_name: str) -> dict[str, Any]:
        assert object_name == expected_cache_path
        return cached_payload

    def boom_fetch(**_kwargs: Any) -> dict[str, Any]:
        pytest.fail("upstream OCR must not be called when cache exists")

    def boom_put(**_kwargs: Any):
        pytest.fail("cache must not be rewritten on hit")

    monkeypatch.setattr(images_routes, "get_json", fake_get_json)
    monkeypatch.setattr(images_routes, "fetch_image_info", boom_fetch)
    monkeypatch.setattr(images_routes, "put_json", boom_put)

    app = create_app()

    async def override_db():
        async with sessionmaker() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_db
    app.dependency_overrides[get_settings_dep] = _build_settings

    client = TestClient(app)
    token = _login(client, "u1", "pw")

    response = client.get(
        f"/api/v1/images/{image_id}/ocr_info",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json() == cached_payload


def test_ocr_info_cache_miss_fetches_upstream_and_writes_cache(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine, sessionmaker = _bootstrap_db(tmp_path, "ocr_info_miss.db")
    image_id = uuid.uuid4()
    user_id = uuid.uuid4()

    async def init() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessionmaker() as session:
            session.add(
                User(
                    id=user_id,
                    username="u1",
                    password_hash=hash_password("pw"),
                    role="operator",
                    is_active=True,
                )
            )
            session.add(
                Image(
                    id=image_id,
                    user_id=user_id,
                    original_filename="photo.jpg",
                    storage_path=f"uploads/{image_id}.jpeg",
                    format="jpeg",
                    size_bytes=2048,
                    status="processed",
                )
            )
            await session.commit()

    asyncio.run(init())

    import app.api.routes.images as images_routes

    upstream_payload = {
        "status_message": "Imagen procesada correctamente.",
        "filename": "photo.jpg",
        "total_productos": 7,
        "conteo_general": {"Habanera Roja La Guacamaya": 3},
        "porcentaje_anaquel_castillo": 22.22,
    }
    written: dict[str, Any] = {}

    def cache_miss_get_json(**_kwargs: Any) -> dict[str, Any]:
        raise FileNotFoundError("no cache yet")

    def fake_fetch(**kwargs: Any) -> dict[str, Any]:
        written["fetched_with"] = kwargs
        return upstream_payload

    def fake_put_json(*, object_name: str, payload: dict[str, Any]):
        written["object_name"] = object_name
        written["payload"] = payload

    monkeypatch.setattr(images_routes, "get_json", cache_miss_get_json)
    monkeypatch.setattr(images_routes, "fetch_image_info", fake_fetch)
    monkeypatch.setattr(images_routes, "put_json", fake_put_json)
    monkeypatch.setattr(
        images_routes,
        "get_bytes",
        lambda **_: b"\xff\xd8\xff" + b"\x00" * 2000 + b"\xff\xd9",
    )

    app = create_app()

    async def override_db():
        async with sessionmaker() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_db
    app.dependency_overrides[get_settings_dep] = _build_settings

    client = TestClient(app)
    token = _login(client, "u1", "pw")

    response = client.get(
        f"/api/v1/images/{image_id}/ocr_info",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    assert response.json() == upstream_payload
    assert written["object_name"] == f"uploads/{image_id}_ocr_info.json"
    assert written["payload"] == upstream_payload

    fetched = written["fetched_with"]
    assert fetched["base_url"] == "http://ocr.test/apis/ocr"
    assert fetched["filename"] == "photo.jpg"
    assert fetched["content_type"] == "image/jpeg"
    assert fetched["timeout_seconds"] == 5.0


def test_ocr_info_upstream_failure_returns_502(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine, sessionmaker = _bootstrap_db(tmp_path, "ocr_info_502.db")
    image_id = uuid.uuid4()
    user_id = uuid.uuid4()

    async def init() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessionmaker() as session:
            session.add(
                User(
                    id=user_id,
                    username="u1",
                    password_hash=hash_password("pw"),
                    role="operator",
                    is_active=True,
                )
            )
            session.add(
                Image(
                    id=image_id,
                    user_id=user_id,
                    original_filename="photo.jpg",
                    storage_path=f"uploads/{image_id}.jpeg",
                    format="jpeg",
                    size_bytes=2048,
                    status="processed",
                )
            )
            await session.commit()

    asyncio.run(init())

    import app.api.routes.images as images_routes

    def cache_miss(**_kwargs: Any) -> dict[str, Any]:
        raise FileNotFoundError("no cache")

    def boom_fetch(**_kwargs: Any) -> dict[str, Any]:
        raise OcrExternalError("upstream timeout")

    def boom_put(**_kwargs: Any):
        pytest.fail("cache must not be written on upstream failure")

    monkeypatch.setattr(images_routes, "get_json", cache_miss)
    monkeypatch.setattr(images_routes, "fetch_image_info", boom_fetch)
    monkeypatch.setattr(images_routes, "put_json", boom_put)
    monkeypatch.setattr(
        images_routes,
        "get_bytes",
        lambda **_: b"\xff\xd8\xff" + b"\x00" * 2000 + b"\xff\xd9",
    )

    app = create_app()

    async def override_db():
        async with sessionmaker() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_db
    app.dependency_overrides[get_settings_dep] = _build_settings

    client = TestClient(app)
    token = _login(client, "u1", "pw")

    response = client.get(
        f"/api/v1/images/{image_id}/ocr_info",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 502
    body = response.json()
    assert body["error"] == "BAD_GATEWAY"
    assert "upstream timeout" in body["message"]


def test_ocr_info_returns_404_when_image_missing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine, sessionmaker = _bootstrap_db(tmp_path, "ocr_info_404.db")
    user_id = uuid.uuid4()
    missing_id = uuid.uuid4()

    async def init() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessionmaker() as session:
            session.add(
                User(
                    id=user_id,
                    username="u1",
                    password_hash=hash_password("pw"),
                    role="operator",
                    is_active=True,
                )
            )
            await session.commit()

    asyncio.run(init())

    import app.api.routes.images as images_routes

    monkeypatch.setattr(
        images_routes,
        "fetch_image_info",
        lambda **_: pytest.fail("upstream must not be called for missing image"),
    )

    app = create_app()

    async def override_db():
        async with sessionmaker() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_db
    app.dependency_overrides[get_settings_dep] = _build_settings

    client = TestClient(app)
    token = _login(client, "u1", "pw")

    response = client.get(
        f"/api/v1/images/{missing_id}/ocr_info",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404


def test_ocr_info_allows_authenticated_user_to_read_any_image(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine, sessionmaker = _bootstrap_db(tmp_path, "ocr_info_otheruser.db")
    image_id = uuid.uuid4()
    owner_id = uuid.uuid4()

    async def init() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessionmaker() as session:
            session.add(
                User(
                    username="u1",
                    password_hash=hash_password("pw"),
                    role="operator",
                    is_active=True,
                )
            )
            session.add(
                User(
                    id=owner_id,
                    username="owner",
                    password_hash=hash_password("pw"),
                    role="operator",
                    is_active=True,
                )
            )
            session.add(
                Image(
                    id=image_id,
                    user_id=owner_id,
                    original_filename="photo.jpg",
                    storage_path=f"uploads/{image_id}.jpeg",
                    format="jpeg",
                    size_bytes=2048,
                    status="processed",
                )
            )
            await session.commit()

    asyncio.run(init())

    import app.api.routes.images as images_routes

    cached_payload = {
        "status_message": "Imagen procesada correctamente.",
        "filename": "photo.jpg",
    }
    monkeypatch.setattr(images_routes, "get_json", lambda **_: cached_payload)
    monkeypatch.setattr(
        images_routes,
        "fetch_image_info",
        lambda **_: pytest.fail("upstream must not be called when cache exists"),
    )

    app = create_app()

    async def override_db():
        async with sessionmaker() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_db
    app.dependency_overrides[get_settings_dep] = _build_settings

    client = TestClient(app)
    token = _login(client, "u1", "pw")

    response = client.get(
        f"/api/v1/images/{image_id}/ocr_info",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json() == cached_payload


def test_ocr_info_allows_analyst_to_read_any_image(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine, sessionmaker = _bootstrap_db(tmp_path, "ocr_info_analyst.db")
    image_id = uuid.uuid4()
    owner_id = uuid.uuid4()

    async def init() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessionmaker() as session:
            session.add(
                User(
                    username="analyst",
                    password_hash=hash_password("pw"),
                    role="analyst",
                    is_active=True,
                )
            )
            session.add(
                User(
                    id=owner_id,
                    username="owner",
                    password_hash=hash_password("pw"),
                    role="operator",
                    is_active=True,
                )
            )
            session.add(
                Image(
                    id=image_id,
                    user_id=owner_id,
                    original_filename="photo.jpg",
                    storage_path=f"uploads/{image_id}.jpeg",
                    format="jpeg",
                    size_bytes=2048,
                    status="processed",
                )
            )
            await session.commit()

    asyncio.run(init())

    import app.api.routes.images as images_routes

    payload = {"status_message": "ok", "total_productos": 1}

    monkeypatch.setattr(images_routes, "get_json", lambda **_: payload)
    monkeypatch.setattr(
        images_routes,
        "fetch_image_info",
        lambda **_: pytest.fail("cache should serve analyst request"),
    )

    app = create_app()

    async def override_db():
        async with sessionmaker() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_db
    app.dependency_overrides[get_settings_dep] = _build_settings

    client = TestClient(app)
    token = _login(client, "analyst", "pw")

    response = client.get(
        f"/api/v1/images/{image_id}/ocr_info",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json() == payload


def test_ocr_info_returns_422_when_original_too_small(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine, sessionmaker = _bootstrap_db(tmp_path, "ocr_info_tiny.db")
    image_id = uuid.uuid4()
    user_id = uuid.uuid4()

    async def init() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessionmaker() as session:
            session.add(
                User(
                    id=user_id,
                    username="u1",
                    password_hash=hash_password("pw"),
                    role="operator",
                    is_active=True,
                )
            )
            session.add(
                Image(
                    id=image_id,
                    user_id=user_id,
                    original_filename="photo.jpg",
                    storage_path=f"uploads/{image_id}.jpeg",
                    format="jpeg",
                    size_bytes=10,
                    status="processed",
                )
            )
            await session.commit()

    asyncio.run(init())

    import app.api.routes.images as images_routes

    def cache_miss(**_kwargs: Any) -> dict[str, Any]:
        raise FileNotFoundError()

    monkeypatch.setattr(images_routes, "get_json", cache_miss)
    monkeypatch.setattr(images_routes, "get_bytes", lambda **_: b"tiny")
    monkeypatch.setattr(
        images_routes,
        "fetch_image_info",
        lambda **_: pytest.fail("upstream must not be called for tiny blob"),
    )

    app = create_app()

    async def override_db():
        async with sessionmaker() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_db
    app.dependency_overrides[get_settings_dep] = _build_settings

    client = TestClient(app)
    token = _login(client, "u1", "pw")

    response = client.get(
        f"/api/v1/images/{image_id}/ocr_info",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422
