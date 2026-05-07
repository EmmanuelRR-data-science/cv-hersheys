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


def test_me_requires_bearer_token(tmp_path) -> None:
    db_path = Path(tmp_path) / "me.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)

    async def init() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessionmaker() as session:
            session.add(
                User(
                    username="bob",
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
    response = client.get("/api/v1/me")
    assert response.status_code == 401


def test_me_returns_current_user(tmp_path) -> None:
    db_path = Path(tmp_path) / "me.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)

    async def init() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessionmaker() as session:
            session.add(
                User(
                    username="alice",
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
    login = client.post("/api/v1/auth/login", json={"username": "alice", "password": "pw"})
    assert login.status_code == 200
    token = login.json()["access_token"]

    me = client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json() == {"username": "alice", "role": "analyst"}
