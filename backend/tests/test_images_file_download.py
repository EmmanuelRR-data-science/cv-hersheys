import asyncio
import uuid
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.dependencies import get_db_session, get_settings_dep
from app.core.config import Settings
from app.core.security import hash_password
from app.db.base import Base
from app.main import create_app
from app.models.image import Image
from app.models.user import User

JWT_SECRET = "dev-secret-dev-secret-dev-secret-dev-secret"


def test_get_image_file_returns_bytes_and_content_type(tmp_path, monkeypatch) -> None:
    db_path = Path(tmp_path) / "images_file.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)

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
                    size_bytes=3,
                    status="pending",
                )
            )
            await session.commit()

    asyncio.run(init())

    app = create_app()

    async def override_db():
        async with sessionmaker() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_db
    app.dependency_overrides[get_settings_dep] = lambda: Settings(
        database_url="sqlite://",
        redis_url="redis://",
        minio_endpoint="http://minio",
        minio_access_key="minioadmin",
        minio_secret_key="minioadmin",
        jwt_secret_key=JWT_SECRET,
    )

    import app.api.routes.images as images_routes

    monkeypatch.setattr(images_routes, "get_bytes", lambda **_: b"abc")

    client = TestClient(app)
    login = client.post("/api/v1/auth/login", json={"username": "u1", "password": "pw"})
    token = login.json()["access_token"]

    response = client.get(
        f"/api/v1/images/{image_id}/file", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/jpeg")
    assert response.content == b"abc"


def test_get_image_file_not_found_for_other_user(tmp_path, monkeypatch) -> None:
    db_path = Path(tmp_path) / "images_file2.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)

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
                Image(
                    id=image_id,
                    user_id=owner_id,
                    original_filename="photo.jpg",
                    storage_path=f"uploads/{image_id}.jpeg",
                    format="jpeg",
                    size_bytes=3,
                    status="pending",
                )
            )
            await session.commit()

    asyncio.run(init())

    app = create_app()

    async def override_db():
        async with sessionmaker() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_db
    app.dependency_overrides[get_settings_dep] = lambda: Settings(
        database_url="sqlite://",
        redis_url="redis://",
        minio_endpoint="http://minio",
        minio_access_key="minioadmin",
        minio_secret_key="minioadmin",
        jwt_secret_key=JWT_SECRET,
    )

    import app.api.routes.images as images_routes

    monkeypatch.setattr(images_routes, "get_bytes", lambda **_: b"abc")

    client = TestClient(app)
    login = client.post("/api/v1/auth/login", json={"username": "u1", "password": "pw"})
    token = login.json()["access_token"]

    response = client.get(
        f"/api/v1/images/{image_id}/file", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 404


def test_get_image_file_allows_analyst_for_other_users_image(tmp_path, monkeypatch) -> None:
    db_path = Path(tmp_path) / "images_file_analyst.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)

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
                    size_bytes=3,
                    status="pending",
                )
            )
            await session.commit()

    asyncio.run(init())

    app = create_app()

    async def override_db():
        async with sessionmaker() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_db
    app.dependency_overrides[get_settings_dep] = lambda: Settings(
        database_url="sqlite://",
        redis_url="redis://",
        minio_endpoint="http://minio",
        minio_access_key="minioadmin",
        minio_secret_key="minioadmin",
        jwt_secret_key=JWT_SECRET,
    )

    import app.api.routes.images as images_routes

    monkeypatch.setattr(images_routes, "get_bytes", lambda **_: b"abc")

    client = TestClient(app)
    login = client.post(
        "/api/v1/auth/login", json={"username": "analyst", "password": "pw"}
    )
    token = login.json()["access_token"]

    response = client.get(
        f"/api/v1/images/{image_id}/file", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.content == b"abc"

