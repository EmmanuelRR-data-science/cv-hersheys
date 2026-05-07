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
from app.models.result import ProcessingResult
from app.models.user import User

JWT_SECRET = "dev-secret-dev-secret-dev-secret-dev-secret"


def test_results_list_returns_all_for_analyst_and_scoped_for_operator(tmp_path) -> None:
    db_path = Path(tmp_path) / "results.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)

    async def init() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessionmaker() as session:
            analyst = User(
                username="analyst",
                password_hash=hash_password("pw"),
                role="analyst",
                is_active=True,
            )
            op = User(
                username="op",
                password_hash=hash_password("pw"),
                role="operator",
                is_active=True,
            )
            session.add_all([analyst, op])
            await session.flush()

            img1 = Image(
                user_id=op.id,
                original_filename="a.jpg",
                storage_path="uploads/a.jpeg",
                format="jpeg",
                size_bytes=10,
                status="processed",
            )
            img2 = Image(
                user_id=analyst.id,
                original_filename="b.jpg",
                storage_path="uploads/b.jpeg",
                format="jpeg",
                size_bytes=10,
                status="processed",
            )
            session.add_all([img1, img2])
            await session.flush()

            session.add_all(
                [
                    ProcessingResult(image_id=img1.id, status="processed", results={"x": 1}),
                    ProcessingResult(image_id=img2.id, status="processed", results={"x": 2}),
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
    analyst_login = client.post(
        "/api/v1/auth/login", json={"username": "analyst", "password": "pw"}
    )
    analyst_token = analyst_login.json()["access_token"]
    op_login = client.post("/api/v1/auth/login", json={"username": "op", "password": "pw"})
    op_token = op_login.json()["access_token"]

    analyst_results = client.get(
        "/api/v1/results", headers={"Authorization": f"Bearer {analyst_token}"}
    )
    assert analyst_results.status_code == 200
    assert analyst_results.json()["total"] == 2

    op_results = client.get("/api/v1/results", headers={"Authorization": f"Bearer {op_token}"})
    assert op_results.status_code == 200
    assert op_results.json()["total"] == 1
