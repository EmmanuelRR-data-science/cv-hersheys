import asyncio
from io import BytesIO
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.dependencies import get_db_session, get_settings_dep
from app.core.config import Settings
from app.core.security import hash_password
from app.db.base import Base
from app.main import create_app
from app.models.image import Image
from app.models.user import User

JWT_SECRET = "dev-secret-dev-secret-dev-secret-dev-secret"


def _minimal_jpeg() -> bytes:
    return b"\xff\xd8\xff" + b"\x00\x00" + b"\xff\xd9"


def test_upload_image_creates_db_record_and_returns_201(tmp_path) -> None:
    db_path = Path(tmp_path) / "images.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)

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

    client = TestClient(app)
    login = client.post("/api/v1/auth/login", json={"username": "u1", "password": "pw"})
    assert login.status_code == 200
    token = login.json()["access_token"]

    files = {"file": ("photo.jpg", BytesIO(_minimal_jpeg()), "image/jpeg")}
    response = client.post(
        "/api/v1/images", files=files, headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 201
    payload = response.json()
    assert "id" in payload
    assert payload["status"] == "pending"

    async def assert_db() -> None:
        async with sessionmaker() as session:
            images = (await session.execute(select(Image))).scalars().all()
            assert len(images) == 1
            assert images[0].original_filename == "photo.jpg"
            assert images[0].format in {"jpeg", "png"}
            assert images[0].status == "pending"

    asyncio.run(assert_db())


def test_upload_image_without_token_uses_demo_mobile_user(tmp_path) -> None:
    db_path = Path(tmp_path) / "images-demo.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)

    async def init() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

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

    client = TestClient(app)
    files = {"file": ("photo.jpg", BytesIO(_minimal_jpeg()), "image/jpeg")}
    response = client.post("/api/v1/images", files=files)
    assert response.status_code == 201

    async def assert_db() -> None:
        async with sessionmaker() as session:
            users = (await session.execute(select(User))).scalars().all()
            images = (await session.execute(select(Image))).scalars().all()
            assert len(users) == 1
            assert users[0].username == "mobile-demo"
            assert len(images) == 1
            assert images[0].user_id == users[0].id

    asyncio.run(assert_db())


def test_upload_rejects_unsupported_format(tmp_path) -> None:
    db_path = Path(tmp_path) / "images.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)

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

    client = TestClient(app)
    login = client.post("/api/v1/auth/login", json={"username": "u1", "password": "pw"})
    token = login.json()["access_token"]

    files = {"file": ("bad.bin", BytesIO(b"not-an-image"), "application/octet-stream")}
    response = client.post(
        "/api/v1/images", files=files, headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 400
