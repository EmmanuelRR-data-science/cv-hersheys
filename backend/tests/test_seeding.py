import asyncio
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.security import verify_password
from app.db.base import Base
from app.db.seeding import seed_default_dashboard_user
from app.models.user import User


def test_seed_default_dashboard_user_is_idempotent_and_sets_credentials(tmp_path) -> None:
    db_path = Path(tmp_path) / "seed.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)

    async def run() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with sessionmaker() as session:
            await seed_default_dashboard_user(session)
            await seed_default_dashboard_user(session)
            await session.commit()

        async with sessionmaker() as session:
            users = (await session.execute(select(User))).scalars().all()
            assert len(users) == 1
            user = users[0]
            assert user.username == "hersheys"
            assert user.role == "analyst"
            assert user.is_active is True
            assert verify_password("cv-hersheys", user.password_hash) is True

    asyncio.run(run())
