import asyncio
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.dependencies import get_db_session, get_settings_dep
from app.core.config import Settings
from app.core.security import hash_password
from app.db.base import Base
from app.main import create_app
from app.models.user import User

JWT_SECRET = "dev-secret-dev-secret-dev-secret-dev-secret"


def test_login_returns_token_for_valid_credentials(tmp_path) -> None:
    db_path = Path(tmp_path) / "test.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)

    async def init() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessionmaker() as session:
            session.add(
                User(
                    username="hersheys",
                    password_hash=hash_password("cv-hersheys"),
                    role="analyst",
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
    response = client.post(
        "/api/v1/auth/login", json={"username": "hersheys", "password": "cv-hersheys"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert isinstance(body["access_token"], str)
    assert body["access_token"]


def test_login_locks_account_after_5_failed_attempts(tmp_path) -> None:
    db_path = Path(tmp_path) / "test.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)

    async def init() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessionmaker() as session:
            session.add(
                User(
                    username="operator1",
                    password_hash=hash_password("correct"),
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
    for _ in range(5):
        response = client.post(
            "/api/v1/auth/login", json={"username": "operator1", "password": "wrong"}
        )
        assert response.status_code == 401

    response = client.post(
        "/api/v1/auth/login", json={"username": "operator1", "password": "correct"}
    )
    assert response.status_code == 423


def test_refresh_returns_new_token_when_authorized(tmp_path) -> None:
    db_path = Path(tmp_path) / "test.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)

    async def init() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessionmaker() as session:
            session.add(
                User(
                    username="analyst1",
                    password_hash=hash_password("pw"),
                    role="analyst",
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
    login = client.post("/api/v1/auth/login", json={"username": "analyst1", "password": "pw"})
    assert login.status_code == 200
    token = login.json()["access_token"]

    refresh = client.post("/api/v1/auth/refresh", headers={"Authorization": f"Bearer {token}"})
    assert refresh.status_code == 200
    new_token = refresh.json()["access_token"]
    assert new_token != token
