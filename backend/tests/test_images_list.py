import asyncio
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


def test_list_images_returns_only_current_users_images(tmp_path) -> None:
    db_path = Path(tmp_path) / "list.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)

    async def init() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessionmaker() as session:
            u1 = User(
                username="u1",
                password_hash=hash_password("pw"),
                role="operator",
                is_active=True,
            )
            u2 = User(
                username="u2",
                password_hash=hash_password("pw"),
                role="operator",
                is_active=True,
            )
            session.add_all([u1, u2])
            await session.flush()

            session.add_all(
                [
                    Image(
                        user_id=u1.id,
                        original_filename="a.jpg",
                        storage_path="uploads/a.jpeg",
                        format="jpeg",
                        size_bytes=10,
                        status="pending",
                        store_name="Walmart Universidad",
                        store_code="WMT-UNIV",
                    ),
                    Image(
                        user_id=u2.id,
                        original_filename="b.jpg",
                        storage_path="uploads/b.jpeg",
                        format="jpeg",
                        size_bytes=10,
                        status="pending",
                    ),
                ]
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

    response = client.get("/api/v1/images", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert len(body["items"]) == 1
    assert body["items"][0]["original_filename"] == "a.jpg"
    assert body["items"][0]["store_name"] == "Walmart Universidad"
    assert body["items"][0]["store_code"] == "WMT-UNIV"


def test_get_image_by_id_returns_404_when_not_owned(tmp_path) -> None:
    db_path = Path(tmp_path) / "list.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)

    async def init() -> str:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessionmaker() as session:
            u1 = User(
                username="u1",
                password_hash=hash_password("pw"),
                role="operator",
                is_active=True,
            )
            u2 = User(
                username="u2",
                password_hash=hash_password("pw"),
                role="operator",
                is_active=True,
            )
            session.add_all([u1, u2])
            await session.flush()
            img = Image(
                user_id=u2.id,
                original_filename="b.jpg",
                storage_path="uploads/b.jpeg",
                format="jpeg",
                size_bytes=10,
                status="pending",
            )
            session.add(img)
            await session.commit()
            return str(img.id)

    other_image_id = asyncio.run(init())

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

    response = client.get(
        f"/api/v1/images/{other_image_id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 404


def test_get_image_by_id_allows_analyst_for_other_users_image(tmp_path) -> None:
    db_path = Path(tmp_path) / "list_analyst.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)

    async def init() -> str:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessionmaker() as session:
            analyst = User(
                username="analyst",
                password_hash=hash_password("pw"),
                role="analyst",
                is_active=True,
            )
            owner = User(
                username="owner",
                password_hash=hash_password("pw"),
                role="operator",
                is_active=True,
            )
            session.add_all([analyst, owner])
            await session.flush()
            img = Image(
                user_id=owner.id,
                original_filename="owned.jpg",
                storage_path="uploads/owned.jpeg",
                format="jpeg",
                size_bytes=10,
                status="processed",
                store_name="Walmart Universidad",
                store_code="WMT-UNIV",
            )
            session.add(img)
            await session.commit()
            return str(img.id)

    image_id = asyncio.run(init())

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
    login = client.post("/api/v1/auth/login", json={"username": "analyst", "password": "pw"})
    token = login.json()["access_token"]

    response = client.get(
        f"/api/v1/images/{image_id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["original_filename"] == "owned.jpg"
    assert response.json()["store_name"] == "Walmart Universidad"
    assert response.json()["store_code"] == "WMT-UNIV"
