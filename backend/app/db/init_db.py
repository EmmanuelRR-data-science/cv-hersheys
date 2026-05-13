import asyncio

from sqlalchemy import inspect, text

from app.db.base import Base
from app.db.engine import get_async_engine
from app.db.seeding import seed_default_dashboard_user
from app.db.session import get_sessionmaker


async def _ensure_image_store_columns(conn) -> None:
    def has_column(sync_conn, column_name: str) -> bool:
        columns = inspect(sync_conn).get_columns("images")
        return any(column["name"] == column_name for column in columns)

    if not await conn.run_sync(has_column, "store_name"):
        await conn.execute(text("ALTER TABLE images ADD COLUMN store_name varchar(255) NULL"))
    if not await conn.run_sync(has_column, "store_code"):
        await conn.execute(text("ALTER TABLE images ADD COLUMN store_code varchar(50) NULL"))


async def init_db() -> None:
    __import__("app.models.image")
    __import__("app.models.result")
    __import__("app.models.user")

    engine = get_async_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _ensure_image_store_columns(conn)

    sessionmaker = get_sessionmaker()
    async with sessionmaker() as session:
        await seed_default_dashboard_user(session)
        await session.commit()


def main() -> None:
    asyncio.run(init_db())


if __name__ == "__main__":
    main()
