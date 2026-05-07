from fastapi import HTTPException
from jwt import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tokens import decode_token
from app.models.user import User


async def get_current_user(
    *,
    token: str,
    session: AsyncSession,
    jwt_secret_key: str,
    jwt_algorithm: str = "HS256",
) -> User:
    try:
        payload = decode_token(token, jwt_secret_key=jwt_secret_key, jwt_algorithm=jwt_algorithm)
    except InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="invalid token") from exc

    subject = payload.get("sub")
    if not subject:
        raise HTTPException(status_code=401, detail="invalid token")

    user = (
        await session.execute(select(User).where(User.username == str(subject)))
    ).scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="invalid token")

    return user
