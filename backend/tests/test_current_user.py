import asyncio
from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.security import hash_password
from app.core.tokens import issue_access_token
from app.db.base import Base
from app.models.user import User
from app.security.current_user import get_current_user

JWT_SECRET = "dev-secret-dev-secret-dev-secret-dev-secret"


def test_get_current_user_returns_user_for_valid_token(tmp_path) -> None:
    db_path = Path(tmp_path) / "auth.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)

    async def run() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessionmaker() as session:
            user = User(
                username="alice",
                password_hash=hash_password("pw"),
                role="operator",
                is_active=True,
            )
            session.add(user)
            await session.commit()

        async with sessionmaker() as session:
            token = issue_access_token(
                subject="alice",
                now=datetime.now(tz=UTC),
                jwt_secret_key=JWT_SECRET,
            )
            loaded = await get_current_user(
                token=token,
                session=session,
                jwt_secret_key=JWT_SECRET,
            )
            assert loaded.username == "alice"

    asyncio.run(run())


def test_get_current_user_raises_401_for_invalid_token(tmp_path) -> None:
    db_path = Path(tmp_path) / "auth.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)

    async def run() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessionmaker() as session:
            with pytest.raises(HTTPException) as exc:
                await get_current_user(
                    token="not-a-jwt",
                    session=session,
                    jwt_secret_key=JWT_SECRET,
                )
            assert exc.value.status_code == 401

    asyncio.run(run())


def test_get_current_user_raises_401_when_user_not_found(tmp_path) -> None:
    db_path = Path(tmp_path) / "auth.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)

    async def run() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessionmaker() as session:
            token = issue_access_token(
                subject="missing",
                now=datetime.now(tz=UTC),
                jwt_secret_key=JWT_SECRET,
            )
            with pytest.raises(HTTPException) as exc:
                await get_current_user(
                    token=token,
                    session=session,
                    jwt_secret_key=JWT_SECRET,
                )
            assert exc.value.status_code == 401

    asyncio.run(run())
