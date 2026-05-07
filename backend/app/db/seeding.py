from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import User


async def seed_default_dashboard_user(session: AsyncSession) -> None:
    existing = (
        await session.execute(select(User).where(User.username == "hersheys"))
    ).scalar_one_or_none()
    if existing is not None:
        return

    session.add(
        User(
            username="hersheys",
            password_hash=hash_password("cv-hersheys"),
            role="analyst",
            is_active=True,
        )
    )
