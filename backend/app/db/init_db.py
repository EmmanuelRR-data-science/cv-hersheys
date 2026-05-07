import asyncio

from app.db.base import Base
from app.db.engine import get_async_engine
from app.db.seeding import seed_default_dashboard_user
from app.db.session import get_sessionmaker


async def init_db() -> None:
    __import__("app.models.image")
    __import__("app.models.result")
    __import__("app.models.user")

    engine = get_async_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    sessionmaker = get_sessionmaker()
    async with sessionmaker() as session:
        await seed_default_dashboard_user(session)
        await session.commit()


def main() -> None:
    asyncio.run(init_db())


if __name__ == "__main__":
    main()
