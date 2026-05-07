from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_bearer_token, get_db_session, get_settings_dep
from app.core.config import Settings
from app.core.security import verify_password
from app.core.tokens import issue_access_token, refresh_access_token
from app.models.user import User

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings_dep),
) -> TokenResponse:
    result = await session.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="invalid credentials")

    now = datetime.now(tz=UTC)
    if user.locked_until is not None and _as_utc(user.locked_until) > now:
        raise HTTPException(status_code=423, detail="account locked")

    if not verify_password(body.password, user.password_hash):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.locked_until = now + timedelta(minutes=15)
        await session.commit()
        raise HTTPException(status_code=401, detail="invalid credentials")

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login = now
    await session.commit()

    token = issue_access_token(
        subject=user.username,
        now=now,
        jwt_secret_key=settings.jwt_secret_key,
        jwt_algorithm=settings.jwt_algorithm,
        access_token_exp_minutes=settings.jwt_access_token_exp_minutes,
    )
    return TokenResponse(access_token=token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    token: str = Depends(get_bearer_token),
    settings: Settings = Depends(get_settings_dep),
) -> TokenResponse:
    now = datetime.now(tz=UTC)
    try:
        new_token = refresh_access_token(
            token,
            now=now,
            jwt_secret_key=settings.jwt_secret_key,
            jwt_algorithm=settings.jwt_algorithm,
            access_token_exp_minutes=settings.jwt_access_token_exp_minutes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    return TokenResponse(access_token=new_token)
